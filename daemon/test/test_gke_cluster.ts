import * as chai from "chai"
chai.should()

import * as protosTypes from "@google-cloud/container/build/protos/protos"
import { GkeCluster } from "../src/gke_cluster"
import { V1NamespaceList, V1PodList } from "@kubernetes/client-node"

class MockGkeClient {
    public args: protosTypes.google.container.v1.SetNodePoolSizeRequest[]
    constructor(private projectId: string) {
        this.args = []
    }
    async getProjectId(): Promise<string> {
        return this.projectId;
    }
    async setNodePoolSize(request: protosTypes.google.container.v1.SetNodePoolSizeRequest): Promise<[protosTypes.google.container.v1.IOperation, protosTypes.google.container.v1.ISetNodePoolSizeRequest | undefined, {} | undefined]> {
        this.args.push(request)
        return [{}, undefined, undefined]
    }
}
class MockKubectlClient {
    public args: [string, string[]][]
    constructor(private namespaces: V1NamespaceList, private pods: Map<string, V1PodList>) {
        this.args = []
    }
    async listNamespace(): Promise<{body: V1NamespaceList}> {
        return {body: this.namespaces}
    }
    async listNamespacedPod(namespace: string): Promise<{body: V1PodList}> {
        if (this.pods.has(namespace)) {
            return {body: this.pods.get(namespace)}
        } else {
            return {body: {items: []}}
        }
    }
}

describe("GkeCluster", () => {
    describe("#activate", () => {
        it("resize the default node pool size to 1", async () => {
            const client = new MockGkeClient("project")
            const cluster = new GkeCluster(
                {clusterName: "cluster", zone: "zone"},
                client,
                new MockKubectlClient({items: []}, new Map()));
            await cluster.activate()
            client.args.should.deep.equal([
                {
                    name: "projects/project/zones/zone/clusters/cluster/nodePools/default-pool",
                    nodeCount: 1
                }
            ])
        })
        it("use project argument to activate", async () => {
            const client = new MockGkeClient("project")
            const cluster = new GkeCluster(
                {clusterName: "cluster", zone: "zone", project: "pj"},
                client,
                new MockKubectlClient({items: []}, new Map()));
            await cluster.activate()
            client.args.should.deep.equal([
                {
                    name: "projects/pj/zones/zone/clusters/cluster/nodePools/default-pool",
                    nodeCount: 1
                }
            ])
        })
    })
    describe("#deactivate", () => {
        it("resize the default node pool size to 0", async () => {
            const client = new MockGkeClient("project")
            const cluster = new GkeCluster(
                {clusterName: "cluster", zone: "zone"},
                client,
                new MockKubectlClient({items: []}, new Map()));
            await cluster.deactivate()
            client.args.should.deep.equal([
                {
                    name: "projects/project/zones/zone/clusters/cluster/nodePools/default-pool",
                    nodeCount: 0
                }
            ])
        })
    })
    describe("#canBeDeactivated", () => {
        it("return false if running pods are exists", async () => {
            const client = new MockKubectlClient(
                {items: [{metadata: {name: "default"}}]},
                new Map([["default", {items: [{status: {phase: "Running"}}]}]])
            )
            const cluster = new GkeCluster(
                {clusterName: "cluster", zone: "zone"},
                new MockGkeClient("project"),
                client);
            (await cluster.canBeDeactivated()).should.equal(false)
        })
        it("return false if pending pods are exists", async () => {
            const client = new MockKubectlClient(
                {items: [{metadata: {name: "default"}}]},
                new Map([["default", {items: [{status: {phase: "Pending"}}]}]])
            )
            const cluster = new GkeCluster(
                {clusterName: "cluster", zone: "zone"},
                new MockGkeClient("project"),
                client);
            (await cluster.canBeDeactivated()).should.equal(false)
        })
        it("return true if there is no pod", async () => {
            const client = new MockKubectlClient(
                {items: [{metadata: {name: "default"}}]},
                new Map()
            )
            const cluster = new GkeCluster(
                {clusterName: "cluster", zone: "zone"},
                new MockGkeClient("project"),
                client);
            (await cluster.canBeDeactivated()).should.equal(true)
        })
        it("ignore system pods", async () => {
            const client = new MockKubectlClient(
                {items: [{metadata: {name: "kube-public"}},
                         {metadata: {name: "kube-system"}},
                         {metadata: {name: "kube-node-lease"}}]},
                new Map(
                    [["kube-public", {items: [{status: {phase: "Running"}}]}],
                     ["kube-system", {items: [{status: {phase: "Running"}}]}],
                     ["kube-node-lease", {items: [{status: {phase: "Running"}}]}]]
                )
            )
            const cluster = new GkeCluster(
                {clusterName: "cluster", zone: "zone"},
                new MockGkeClient("project"),
                client);
            (await cluster.canBeDeactivated()).should.equal(true)
        })
        it("ignore finished pod", async () => {
            const client = new MockKubectlClient(
                {items: [{metadata: {name: "default"}}]},
                new Map(
                    [["default", {items: [
                        {status: {phase: "Failed"}},
                        {status: {phase: "Unknown"}},
                        {status: {phase: "Succeeded"}}
                    ]}]],
                )
            )
            const cluster = new GkeCluster(
                {clusterName: "cluster", zone: "zone"},
                new MockGkeClient("project"),
                client);
            (await cluster.canBeDeactivated()).should.equal(true)
        })
    })
})
