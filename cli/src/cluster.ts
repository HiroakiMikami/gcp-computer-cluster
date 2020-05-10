import * as path from "path";

const DEFAULT_NODE_POOL_NAME = "default-pool"
const SHARED_COMPONENTS_PREFIX = "gcp-computer-cluster-"

export interface Accelerator {
    type: string;
    count: number;
}

export interface NodePool {
    machineType: string;
    numMaxNodes: number;
    accelerators: ReadonlyArray<Accelerator>;
    preemptible: boolean;
}

export interface ClusterConfig {
    name: string;
    account?: string;
    project?: string;
    zone: string;
    useLoggingService?: boolean;
    useMonitoringService?: boolean;
    numKubeDnsReplicas?: number;
    nodePools: { [name: string]: NodePool };
    timezone?: string;
    autoDeactivationSchedule?: string;
}
interface FixedClusterConfig {
    name: string;
    account?: string;
    project?: string;
    zone: string;
    useLoggingService: boolean;
    useMonitoringService: boolean;
    numKubeDnsReplicas: number;
    nodePools: ReadonlyMap<string, NodePool>;
    timezone?: string;
    autoDeactivationSchedule: string;
}

function setDefaultConfig(config: ClusterConfig): FixedClusterConfig {
    const useLoggingService = (config.useLoggingService == null) ? false : config.useLoggingService
    const useMonitoringService = (config.useMonitoringService == null) ? false : config.useMonitoringService
    const numKubeDnsReplicas = (config.numKubeDnsReplicas == null) ? 0 : config.numKubeDnsReplicas
    const nodePools = new Map()
    for (const name in config.nodePools) {
        nodePools.set(name, config.nodePools[name])
    }
    const autoDeactivationSchedule = (config.autoDeactivationSchedule == null)
        ? "0 1 * * *"
        : config.autoDeactivationSchedule
    return {
        name: config.name, account: config.account, project: config.project,
        zone: config.zone, useLoggingService, useMonitoringService, numKubeDnsReplicas,
        timezone: config.timezone, nodePools, autoDeactivationSchedule
    }
}

export class Cluster {
    private config: FixedClusterConfig
    private gcloudOptions: string[]
    private clusterOptions: string[]
    private topicName: string

    public constructor(config: ClusterConfig,
        private gcloud: (args: string[]) => Promise<void>,
        private kubectl: (args: string[]) => Promise<void>) {
        this.config = setDefaultConfig(config)
        this.gcloudOptions = []
        if (this.config.account) {
            this.gcloudOptions.push(`--account=${this.config.account}`)
        }
        if (this.config.project) {
            this.gcloudOptions.push(`--project=${this.config.project}`)
        }
        this.clusterOptions = [`--zone=${this.config.zone}`]
        this.topicName = `${SHARED_COMPONENTS_PREFIX}cluster-deactivation`
    }

    public async create(): Promise<void> {
        // Create Cluster
        await this.gcloud([
            "beta", "container", "clusters", "create", this.config.name,
            "--num-nodes", "1", "--addons=GcePersistentDiskCsiDriver"]
            .concat(this.gcloudOptions)
            .concat(this.clusterOptions))

        // Create node pools
        for (const elem of Array.from(this.config.nodePools)) {
            const [name, nodePool] = elem
            const preemptible = nodePool.preemptible ? ["--preemptible"] : []
            let accelerators: string[] = []
            if (nodePool.accelerators.length !== 0) {
                accelerators.push("--accelerator")
                accelerators = accelerators.concat(
                    Array.from(nodePool.accelerators).map(accelerator => {
                        return `type=${accelerator.type},count=${accelerator.count}`
                    }))
            }
            await this.gcloud([
                "container", "node-pools", "create", name, `--cluster=${this.config.name}`,
                "--enable-autoscaling", `--max-nodes=${nodePool.numMaxNodes}`,
                "--min-nodes=0", "--num-nodes=0", "--machine-type", nodePool.machineType,
                `--node-taints=gcp-computer-cluster.preemptible=${nodePool.preemptible}:NoSchedule`]
                .concat(accelerators)
                .concat(preemptible)
                .concat(this.gcloudOptions)
                .concat(this.clusterOptions))
        }

        // Change profile
        await this.gcloud([
            "beta", "container", "clusters", "update", this.config.name,
            "--autoscaling-profile", "optimize-utilization"]
            .concat(this.gcloudOptions)
            .concat(this.clusterOptions))

        // Remove addons
        await this.gcloud([
            "container", "clusters", "update", this.config.name,
            "--update-addons=HorizontalPodAutoscaling=DISABLED"]
            .concat(this.gcloudOptions)
            .concat(this.clusterOptions))
        const target = []
        if (!this.config.useLoggingService) {
            target.push("--logging-service")
            target.push("none")
        }
        if (!this.config.useMonitoringService) {
            target.push("--monitoring-service")
            target.push("none")
        }
        if (target.length !== 0) {
            await this.gcloud([
                "beta", "container", "clusters", "update", this.config.name]
                .concat(target)
                .concat(this.gcloudOptions)
                .concat(this.clusterOptions))
        }

        // Update kubeconfig file
        await this.gcloud([
            "container", "clusters", "get-credentials", this.config.name]
            .concat(this.gcloudOptions)
            .concat(this.clusterOptions))

        // Update KubeDNS
        await this.kubectl([
            "scale", `--replicas=${this.config.numKubeDnsReplicas}`,
            "deployment/kube-dns-autoscaler", "--namespace=kube-system"
        ])

        // Add DaemonSet to install GPU driver
        await this.kubectl([
            "apply", "-f",
            "https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/master/nvidia-driver-installer/cos/daemonset-preloaded.yaml"
        ])

        // Create scheduler for auto deactivation
        const messageBody: any = {
            clusterName: this.config.name,
            zone: this.config.zone
        }
        if (this.config.project != null) {
            messageBody.project = this.config.project
        }
        const timeZoneArgs: string[] = []
        if (this.config.timezone != null) {
            timeZoneArgs.push("--time-zone")
            timeZoneArgs.push(this.config.timezone)
        }
        await this.gcloud([
            "beta", "scheduler", "jobs", "create", "pubsub",
            `${SHARED_COMPONENTS_PREFIX}autodeactivation-${this.config.name}`,
            "--schedule", '"' + this.config.autoDeactivationSchedule + '"',
            "--topic", this.topicName,
            "--message-body", "'" + JSON.stringify(messageBody) + "'"]
            .concat(timeZoneArgs)
            .concat(this.gcloudOptions))
        return
    }

    public async delete(): Promise<void> {
        // Delete cluster
        await this.gcloud([
            "container", "clusters", "delete", this.config.name, "--quiet"]
            .concat(this.gcloudOptions)
            .concat(this.clusterOptions))
        await this.gcloud([
            "beta", "scheduler", "jobs", "delete",
            `${SHARED_COMPONENTS_PREFIX}autodeactivation-${this.config.name}`, "--quiet"]
            .concat(this.gcloudOptions))
        return
    }

    public async activate(): Promise<void> {
        // Resize default pool to 1
        await this.gcloud([
            "container", "clusters", "resize", this.config.name, "--node-pool",
            DEFAULT_NODE_POOL_NAME, "--num-nodes", "1", "--quiet"]
            .concat(this.gcloudOptions)
            .concat(this.clusterOptions))
        return
    }

    public async deactivate(): Promise<void> {
        // Resize default pool to 0
        await this.gcloud([
            "container", "clusters", "resize", this.config.name, "--node-pool",
            DEFAULT_NODE_POOL_NAME, "--num-nodes", "0", "--quiet"]
            .concat(this.gcloudOptions)
            .concat(this.clusterOptions))
        return
    }

    public async createSharedComponents(): Promise<void> {
        const dir = __dirname.split(path.sep) // <root>/cli/out/src/
        dir.pop() // <root>/cli/out/
        dir.pop() // <root>/cli/
        dir.pop() // <root>/
        dir.push("daemon")
        const daemonPath = path.join(path.parse(__dirname).root, ...dir)

        // Create pubsub
        await this.gcloud([
            "pubsub", "topics", "create", this.topicName]
            .concat(this.gcloudOptions))

        // Create cloud functions
        await this.gcloud([
            "functions", "deploy", `${SHARED_COMPONENTS_PREFIX}deactivate-cluster`,
            "--trigger-topic", this.topicName, "--runtime", "nodejs10",
            "--entry-point=deactivationPubSub",
            "--source", daemonPath, "--quiet"]
            .concat(this.gcloudOptions))
    }
    public async deleteSharedComponents(): Promise<void> {
        // Delete pubsub
        const topicName = `${SHARED_COMPONENTS_PREFIX}cluster-deactivation`
        await this.gcloud([
            "pubsub", "topics", "delete", topicName, "--quiet"]
            .concat(this.gcloudOptions))

        // Create cloud functions
        await this.gcloud([
            "functions", "delete", `${SHARED_COMPONENTS_PREFIX}deactivate-cluster`,
            "--quiet"]
            .concat(this.gcloudOptions))
    }
}
