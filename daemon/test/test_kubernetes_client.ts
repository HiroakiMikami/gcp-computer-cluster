import * as chai from "chai"
chai.should()

import * as protosTypes from "@google-cloud/container/build/protos/protos"
import { createKubernetesClientInGcp } from "../src/kubernetes_client"

class MockGkeClient {
    public args: protosTypes.google.container.v1.IGetClusterRequest[]
    constructor(private projectId: string) {
        this.args = []
    }
    async getProjectId(): Promise<string> {
        return this.projectId;
    }
    async setNodePoolSize(request: protosTypes.google.container.v1.ISetNodePoolSizeRequest): Promise<[protosTypes.google.container.v1.IOperation, protosTypes.google.container.v1.ISetNodePoolSizeRequest | undefined, {} | undefined]> {
        throw request
    }
    async getCluster(request: protosTypes.google.container.v1.IGetClusterRequest): Promise<[protosTypes.google.container.v1.ICluster, protosTypes.google.container.v1.IGetClusterRequest | undefined, {} | undefined]> {
        this.args.push(request)
        return [{endpoint: "endpoint"}, undefined, undefined];
    }
}
class MockGoogleAuthClient {
    public args: string[]
    constructor() {
        this.args = []
    }
    async getAccessToken(): Promise<string> {
        this.args.push("getAccessToken")
        return "token"
    }
}

describe("#createKubernetesClientInGcp", () => {
    it("create the kubernetes client", async () => {
        const gkeClient = new MockGkeClient("project")
        const googleAuthClient = new MockGoogleAuthClient()
        await createKubernetesClientInGcp(
            {zone: "zone", clusterName: "cluster"},
            gkeClient, googleAuthClient)
        gkeClient.args.should.deep.equal([
            {
                name: "projects/project/zones/zone/clusters/cluster"
            }
        ])
        googleAuthClient.args.should.deep.equal(["getAccessToken"])
    })
})
