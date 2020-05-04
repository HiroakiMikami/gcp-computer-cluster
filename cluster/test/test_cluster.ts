import * as chai from "chai"
chai.should()

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
            nodePools: {}
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
                "https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/master/nvidia-driver-installer/cos/daemonset-preloaded.yaml"]]
        ])
    })
    it("use default values if not set", async () => {
        const mock = new MockCommand()
        const cluster = new Cluster({
            name: "test-cluster",
            nodePools: {}
        },
            async args => mock.gcloud(args),
            async args => mock.kubectl(args))

        await cluster.create()
        mock.args.should.deep.equal([
            ["gcloud", [
                "beta", "container", "clusters", "create", "test-cluster", "--num-nodes", "1",
                "--addons=GcePersistentDiskCsiDriver"]],
            ["gcloud", [
                "beta", "container", "clusters", "update", "test-cluster",
                "--autoscaling-profile", "optimize-utilization"]],
            ["gcloud", [
                "container", "clusters", "update", "test-cluster",
                "--update-addons=HorizontalPodAutoscaling=DISABLED"]],
            ["gcloud", [
                "beta", "container", "clusters", "update", "test-cluster",
                "--logging-service", "none", "--monitoring-service", "none"]],
            ["gcloud", [
                "container", "clusters", "get-credentials", "test-cluster"]],
            ["kubectl", ["scale", "--replicas=0", "deployment/kube-dns-autoscaler", "--namespace=kube-system"]],
            ["kubectl", ["apply", "-f",
                "https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/master/nvidia-driver-installer/cos/daemonset-preloaded.yaml"]]
        ])
    })

    it("use default values if not set", async () => {
        const mock = new MockCommand()
        const cluster = new Cluster({
            name: "test-cluster",
            nodePools: {}
        },
            async args => mock.gcloud(args),
            async args => mock.kubectl(args))

        await cluster.create()
        mock.args.should.deep.equal([
            ["gcloud", [
                "beta", "container", "clusters", "create", "test-cluster", "--num-nodes", "1",
                "--addons=GcePersistentDiskCsiDriver"]],
            ["gcloud", [
                "beta", "container", "clusters", "update", "test-cluster",
                "--autoscaling-profile", "optimize-utilization"]],
            ["gcloud", [
                "container", "clusters", "update", "test-cluster",
                "--update-addons=HorizontalPodAutoscaling=DISABLED"]],
            ["gcloud", [
                "beta", "container", "clusters", "update", "test-cluster",
                "--logging-service", "none", "--monitoring-service", "none"]],
            ["gcloud", [
                "container", "clusters", "get-credentials", "test-cluster"]],
            ["kubectl", ["scale", "--replicas=0", "deployment/kube-dns-autoscaler", "--namespace=kube-system"]],
            ["kubectl", ["apply", "-f",
                "https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/master/nvidia-driver-installer/cos/daemonset-preloaded.yaml"]]
        ])
        it("create node pools", async () => {
            const mock = new MockCommand()
            const cluster = new Cluster({
                name: "test-cluster",
                useLoggingService: true, useMonitoringService: true,
                nodePools: {
                    "cpu": {machineType: "type", numMaxNodes: 1, accelerators: [], preemptible: false},
                    "gpu": {machineType: "type", numMaxNodes: 1, accelerators: [{"type": "gpu", count: 1}],
                             preemptible: true}
                }
            },
                async args => mock.gcloud(args),
                async args => mock.kubectl(args))

            await cluster.create()
            mock.args.should.deep.equal([
                ["gcloud", [
                    "beta", "container", "clusters", "create", "test-cluster", "--num-nodes", "1",
                    "--addons=GcePersistentDiskCsiDriver"]],
                ["gcloud", [
                    "container", "node-pools", "create", "cpu", "--cluster=test-cluster",
                    "--enable-autoscaling", "--max-nodes=1", "--min-nodes", "0", "--num-nodes", "0",
                    "--machine-type", "type", "--node-taints=gcp-computer-cluster.preemptible=false:NoSchedule"]],
                ["gcloud", [
                    "container", "node-pools", "create", "cpu", "--cluster=test-cluster",
                    "--enable-autoscaling", "--max-nodes=1", "--min-nodes", "0", "--num-nodes", "0",
                    "--machine-type", "type", "--node-taints=gcp-computer-cluster.preemptible=true:NoSchedule",
                    "--preemptible", "--accelerator", "type=gpu,count=1"]],
                ["gcloud", [
                    "beta", "container", "clusters", "update", "test-cluster",
                    "--autoscaling-profile", "optimize-utilization"]],
                ["gcloud", [
                    "container", "clusters", "update", "test-cluster",
                    "--update-addons=HorizontalPodAutoscaling=DISABLED"]],
                ["gcloud", [
                    "container", "clusters", "get-credentials", "test-cluster"]],
                ["kubectl", ["scale", "--replicas=0", "deployment/kube-dns-autoscaler", "--namespace=kube-system"]],
                ["kubectl", ["apply", "-f",
                    "https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/master/nvidia-driver-installer/cos/daemonset-preloaded.yaml"]]
            ])
        })
    })

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
                "--account=account", "--project=project", "--zone=zone"]]
        ])
    })
})
