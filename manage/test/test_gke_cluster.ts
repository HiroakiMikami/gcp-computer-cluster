import * as chai from "chai"
chai.should()

import * as protosTypes from "@google-cloud/container/build/protos/protos"
import { GkeCluster } from "../src/gke_cluster"

class MockClient {
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

describe("GkeCluster", () => {
    it("activate the cluster", async () => {
        const client = new MockClient("project")
        const cluster = new GkeCluster("cluster", "zone", null, client);
        await cluster.activate()
        client.args.should.deep.equal([
            {
                name: "projects/project/zones/zone/clusters/cluster/nodePools/default-pool",
                nodeCount: 1
            }
        ])
    })
})
