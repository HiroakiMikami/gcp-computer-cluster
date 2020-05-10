import * as chai from "chai"
chai.should()

import { Executable, Command, Cluster } from "gcp-computer-cluster-cli"
import * as fs from "fs"
import * as path from "path"
import { promisify } from "util"
import { ClusterConfig } from "gcp-computer-cluster-cli/out/src/cluster"

const configFile = process.env.GCP_COMPUTER_CLUSTER_E2E_TEST_CONFIG_FILE
const gcloudPath = process.env.GCP_COMPUTER_CLUSTER_E2E_TEST_GCLOUD_PATH || "gcloud"
const kubectlPath = process.env.GCP_COMPUTER_CLUSTER_E2E_TEST_GCLOUD_PATH || "kubectl"

function sleep(msec: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, msec))
}

async function setup(): Promise<[ClusterConfig, Command, Executable, Executable]> {
    const cfg: ClusterConfig = JSON.parse(await promisify(fs.readFile)(configFile, "utf-8"))
    const gcloud = new Executable(gcloudPath)
    const kubectl = new Executable(kubectlPath)
    const gcloudArgs: string[] = []
    if (cfg.account != null) {
        gcloudArgs.push("--account")
        gcloudArgs.push(cfg.account)
    }
    if (cfg.project != null) {
        gcloudArgs.push("--project")
        gcloudArgs.push(cfg.project)
    }
    const cluster = new Cluster(
        cfg,
        async (args: string[]) => {
            await gcloud.execute(args.concat(gcloudArgs))
            return
        },
        async (args: string[]) => {
            await kubectl.execute(args)
            return
        })
    return [cfg, new Command(cluster, "trace"), gcloud, kubectl]
}

async function isActivated(gcloud: Executable, cfg: ClusterConfig): Promise<boolean> {
    const result = JSON.parse((await gcloud.execute(
        ["container", "node-pools", "describe", "default-pool", "--cluster", cfg.name, "--format", "json"],
        true)).stdout);
    return result.initialNodeCount != null && result.initialNodeCount != 0
}

describe("AutoDeactivation", () => {
    it("deactivate cluster if there is no pending/running pods", async () => {
        const [cfg, command, gcloud] = await setup();

        // Check whether the cluster is deactivated
        (await isActivated(gcloud, cfg)).should.equal(false)

        // Activate the cluster
        await command.activate()

        // Trigger the scheduler for auto-deacitvation
        await gcloud.execute(
            ["beta", "scheduler", "jobs", "run", `gcp-computer-cluster-autodeactivation-${cfg.name}`]
        )
        // Wait for functions
        await sleep(600 * 1000); // Wait for 10min

        // Check whether the cluster is deacitvated
        (await isActivated(gcloud, cfg)).should.equal(false)
    })
    it("skip deactivation if there is pending/running pods", async () => {
        const [cfg, command, gcloud, kubectl] = await setup();

        // Check whether the cluster is deactivated
        (await isActivated(gcloud, cfg)).should.equal(false)

        // Activate the cluster
        await command.activate()

        // Add pending pod
        const dir = __dirname.split(path.sep)
        dir.pop()
        dir.pop()
        dir.push("k8sobject")
        const pendingPodPath = path.join(path.parse(__dirname).root, ...dir, "pending-pod.yaml")
        await kubectl.execute(["apply", "-f", pendingPodPath])

        // Trigger the scheduler for auto-deacitvation
        await gcloud.execute(
            ["beta", "scheduler", "jobs", "run", `gcp-computer-cluster-autodeactivation-${cfg.name}`]
        )

        // Wait for functions
        await sleep(600 * 1000); // Wait for 1min
        
        // Check whether the cluster is activated
        (await isActivated(gcloud, cfg)).should.equal(true)

        // Delete pending pod
        await kubectl.execute(["delete", "pod", "pending-pod"])

        // Deactivate the cluster
        await command.deactivate()
    })
})
