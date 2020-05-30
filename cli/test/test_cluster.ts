import * as chai from "chai"
chai.should()

import * as path from "path"
import { Cluster } from "../src/cluster"

class MockCommand {
    public args: Array<[string, string[]]>;
    constructor() {
        this.args = []
    }
    async gcloud(args: string[]): Promise<void> {
        this.args.push(["gcloud", args])
        return
    }
    async kubectl(args: string[]): Promise<void> {
        this.args.push(["kubectl", args])
        return
    }
}

describe("Cluster", () => {
    describe("#createSharedComponents", () => {
        it("create pubsub topic and cloud functions", async () => {
            const mock = new MockCommand()
            const cluster = new Cluster({
                name: "test-cluster",
                zone: "zone",
                useLoggingService: true,
                useMonitoringService: true,
                numKubeDnsReplicas: 1,
                nodePools: {}
            },
                async args => mock.gcloud(args),
                async args => mock.kubectl(args))

            await cluster.createSharedComponents()
            const dir = __dirname.split(path.sep)
            dir.pop()
            dir.pop()
            dir.pop()
            dir.push("daemon")
            mock.args.should.deep.equal([
                ["gcloud", [
                    "pubsub", "topics", "create", "gcp-computer-cluster-cluster-deactivation"]],
                ["gcloud", [
                    "functions", "deploy", "gcp-computer-cluster-deactivate-cluster",
                    "--trigger-topic", "gcp-computer-cluster-cluster-deactivation",
                    "--runtime", "nodejs10", "--entry-point=deactivationPubSub",
                    "--source", path.join(path.parse(__dirname).root, ...dir), "--quiet"]]
            ])
        })
    })
    describe("#deleteSharedComponents", () => {
        it("delete pubsub topic and cloud functions", async () => {
            const mock = new MockCommand()
            const cluster = new Cluster({
                name: "test-cluster",
                zone: "zone",
                useLoggingService: true,
                useMonitoringService: true,
                numKubeDnsReplicas: 1,
                nodePools: {}
            },
                async args => mock.gcloud(args),
                async args => mock.kubectl(args))

            await cluster.deleteSharedComponents()
            mock.args.should.deep.equal([
                ["gcloud", [
                    "pubsub", "topics", "delete", "gcp-computer-cluster-cluster-deactivation",
                    "--quiet"]],
                ["gcloud", [
                    "functions", "delete", "gcp-computer-cluster-deactivate-cluster",
                    "--quiet"]]
            ])
        })
    })
    describe("#create", () => {
        it("create cluster and configure cluster", async () => {
            const mock = new MockCommand()
            const cluster = new Cluster({
                name: "test-cluster",
                account: "account",
                project: "project",
                zone: "zone",
                useLoggingService: true,
                useMonitoringService: true,
                numKubeDnsReplicas: 1,
                nodePools: {},
                timezone: "Asia/Tokyo",
                autoDeactivationSchedule: "0 2 * * *"
            },
                async args => mock.gcloud(args),
                async args => mock.kubectl(args))

            await cluster.create()
            mock.args.should.deep.equal([
                ["gcloud", [
                    "beta", "container", "clusters", "create", "test-cluster", "--num-nodes", "1",
                    "--addons=GcePersistentDiskCsiDriver",
                    "--account=account", "--project=project", "--zone=zone"]],
                ["gcloud", [
                    "beta", "container", "clusters", "update", "test-cluster",
                    "--autoscaling-profile", "optimize-utilization",
                    "--account=account", "--project=project", "--zone=zone"]],
                ["gcloud", [
                    "container", "clusters", "update", "test-cluster",
                    "--update-addons=HorizontalPodAutoscaling=DISABLED",
                    "--account=account", "--project=project", "--zone=zone"]],
                ["gcloud", [
                    "container", "clusters", "get-credentials", "test-cluster",
                    "--account=account", "--project=project", "--zone=zone"]],
                ["kubectl", ["scale", "--replicas=1", "deployment/kube-dns-autoscaler", "--namespace=kube-system"]],
                ["kubectl", ["apply", "-f",
                    "https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/master/nvidia-driver-installer/cos/daemonset-preloaded.yaml"]],
                ["gcloud", [
                    "beta", "scheduler", "jobs", "create", "pubsub", "gcp-computer-cluster-autodeactivation-test-cluster",
                    "--schedule", '"0 2 * * *"', "--topic", "gcp-computer-cluster-cluster-deactivation",
                    "--message-body",
                    '\'{"clusterName":"test-cluster","zone":"zone","project":"project"}\'',
                    "--quiet", "--time-zone", "Asia/Tokyo", "--account=account", "--project=project"]]
            ])
        })
        it("use default values if not set", async () => {
            const mock = new MockCommand()
            const cluster = new Cluster({
                name: "test-cluster",
                zone: "zone",
                nodePools: {}
            },
                async args => mock.gcloud(args),
                async args => mock.kubectl(args))

            await cluster.create()
            mock.args.should.deep.equal([
                ["gcloud", [
                    "beta", "container", "clusters", "create", "test-cluster", "--num-nodes", "1",
                    "--addons=GcePersistentDiskCsiDriver", "--zone=zone"]],
                ["gcloud", [
                    "beta", "container", "clusters", "update", "test-cluster",
                    "--autoscaling-profile", "optimize-utilization", "--zone=zone"]],
                ["gcloud", [
                    "container", "clusters", "update", "test-cluster",
                    "--update-addons=HorizontalPodAutoscaling=DISABLED", "--zone=zone"]],
                ["gcloud", [
                    "beta", "container", "clusters", "update", "test-cluster",
                    "--logging-service", "none", "--monitoring-service", "none", "--zone=zone"]],
                ["gcloud", [
                    "container", "clusters", "get-credentials", "test-cluster", "--zone=zone"]],
                ["kubectl", ["scale", "--replicas=0", "deployment/kube-dns-autoscaler", "--namespace=kube-system"]],
                ["kubectl", ["apply", "-f",
                    "https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/master/nvidia-driver-installer/cos/daemonset-preloaded.yaml"]],
                ["gcloud", [
                    "beta", "scheduler", "jobs", "create", "pubsub", "gcp-computer-cluster-autodeactivation-test-cluster",
                    "--schedule", '"0 1 * * *"', "--topic", "gcp-computer-cluster-cluster-deactivation",
                    "--message-body", '\'{"clusterName":"test-cluster","zone":"zone"}\'', "--quiet"]]

            ])

            it("create node pools", async () => {
                const mock = new MockCommand()
                const cluster = new Cluster({
                    name: "test-cluster",
                    zone: "zone",
                    useLoggingService: true, useMonitoringService: true,
                    nodePools: {
                        "cpu": { machineType: "type", numMaxNodes: 1, accelerators: [], preemptible: false },
                        "gpu": {
                            machineType: "type", numMaxNodes: 1, accelerators: [{ "type": "gpu", count: 1 }],
                            preemptible: true
                        }
                    }
                },
                    async args => mock.gcloud(args),
                    async args => mock.kubectl(args))

                await cluster.create()
                mock.args.should.deep.equal([
                    ["gcloud", [
                        "beta", "container", "clusters", "create", "test-cluster", "--num-nodes", "1",
                        "--addons=GcePersistentDiskCsiDriver", "--zone=zone"]],
                    ["gcloud", [
                        "container", "node-pools", "create", "cpu", "--cluster=test-cluster",
                        "--enable-autoscaling", "--max-nodes=1", "--min-nodes", "0", "--num-nodes", "0",
                        "--machine-type", "type", "--node-taints=gcp-computer-cluster.preemptible=false:NoSchedule",
                        "--zone=zone"]],
                    ["gcloud", [
                        "container", "node-pools", "create", "cpu", "--cluster=test-cluster",
                        "--enable-autoscaling", "--max-nodes=1", "--min-nodes", "0", "--num-nodes", "0",
                        "--machine-type", "type", "--node-taints=gcp-computer-cluster.preemptible=true:NoSchedule",
                        "--preemptible", "--accelerator", "type=gpu,count=1",
                        "--zone=zone"]],
                    ["gcloud", [
                        "beta", "container", "clusters", "update", "test-cluster",
                        "--autoscaling-profile", "optimize-utilization", "--zone=zone"]],
                    ["gcloud", [
                        "container", "clusters", "update", "test-cluster",
                        "--update-addons=HorizontalPodAutoscaling=DISABLED", "--zone=zone"]],
                    ["gcloud", [
                        "container", "clusters", "get-credentials", "test-cluster", "--zone=zone"]],
                    ["kubectl", ["scale", "--replicas=0", "deployment/kube-dns-autoscaler", "--namespace=kube-system"]],
                    ["kubectl", ["apply", "-f",
                        "https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/master/nvidia-driver-installer/cos/daemonset-preloaded.yaml"]],
                    ["gcloud", [
                        "beta", "scheduler", "jobs", "create", "pubsub", "gcp-computer-cluster-autodeactivation-test-cluster",
                        "--schedule", '"0 1 * * *"', "--topic", "gcp-computer-cluster-cluster-deactivation",
                        "--message-body", '\'{"clusterName":"test-cluster","zone":"zone"}\'', "--quiet"]]
                ])
            })
        })
    })

    describe("#delete", () => {
        it("delete a cluster", async () => {
            const mock = new MockCommand()
            const cluster = new Cluster({
                name: "test-cluster",
                account: "account",
                project: "project",
                zone: "zone",
                useLoggingService: true,
                useMonitoringService: true,
                numKubeDnsReplicas: 1,
                nodePools: {}
            },
                async args => mock.gcloud(args),
                async args => mock.kubectl(args))

            await cluster.delete()
            mock.args.should.deep.equal([
                ["gcloud", [
                    "container", "clusters", "delete", "test-cluster", "--quiet",
                    "--account=account", "--project=project", "--zone=zone"]],
                ["gcloud", [
                    "beta", "scheduler", "jobs", "delete", "gcp-computer-cluster-autodeactivation-test-cluster",
                    "--quiet",
                    "--account=account", "--project=project"]]
            ])
        })
    })

    describe("#activate", () => {
        it("Set the size of default-pool to 1", async () => {
            const mock = new MockCommand()
            const cluster = new Cluster({
                name: "test-cluster",
                account: "account",
                project: "project",
                zone: "zone",
                useLoggingService: true,
                useMonitoringService: true,
                numKubeDnsReplicas: 1,
                nodePools: {}
            },
                async args => mock.gcloud(args),
                async args => mock.kubectl(args))

            await cluster.activate()
            mock.args.should.deep.equal([
                ["gcloud", [
                    "container", "clusters", "resize", "test-cluster", "--node-pool",
                    "default-pool", "--num-nodes", "1", "--quiet",
                    "--account=account", "--project=project", "--zone=zone"]]
            ])
        })
    })

    describe("#deactivate", () => {
        it("set the size of default pool to 0", async () => {
            const mock = new MockCommand()
            const cluster = new Cluster({
                name: "test-cluster",
                account: "account",
                project: "project",
                zone: "zone",
                useLoggingService: true,
                useMonitoringService: true,
                numKubeDnsReplicas: 1,
                nodePools: {}
            },
                async args => mock.gcloud(args),
                async args => mock.kubectl(args))

            await cluster.deactivate()
            mock.args.should.deep.equal([
                ["gcloud", [
                    "container", "clusters", "resize", "test-cluster", "--node-pool",
                    "default-pool", "--num-nodes", "0", "--quiet",
                    "--account=account", "--project=project", "--zone=zone"]]
            ])
        })
    })
})
