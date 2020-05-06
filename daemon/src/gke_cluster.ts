import * as protosTypes from "@google-cloud/container/build/protos/protos"

const DEFAULT_NODE_POOL_NAME = "default-pool"

interface GkeClient {
    getProjectId(): Promise<string>;
    setNodePoolSize(request: protosTypes.google.container.v1.ISetNodePoolSizeRequest): Promise<[protosTypes.google.container.v1.IOperation, protosTypes.google.container.v1.ISetNodePoolSizeRequest | undefined, {} | undefined]>;
}

export interface ClusterConfig {
    clusterName: string;
    zone: string;
    project?: string
}

export class GkeCluster {
    constructor(private config: ClusterConfig, private gkeClient: GkeClient) {
    }
    private async getDefaultNodePoolName(): Promise<string> {
        if (this.config.project == null) {
            this.config.project = await this.gkeClient.getProjectId()
        }
        return `projects/${this.config.project}/zones/${this.config.zone}/clusters/${this.config.clusterName}/nodePools/${DEFAULT_NODE_POOL_NAME}`
    }

    public async activate(): Promise<void> {
        const [response] = await this.gkeClient.setNodePoolSize({
            name: await this.getDefaultNodePoolName(),
            nodeCount: 1
        })
        console.log(`activate API response: ${response}`)
        return
    }

    public async deactivate(): Promise<void> {
        const [response] = await this.gkeClient.setNodePoolSize({
            name: await this.getDefaultNodePoolName(),
            nodeCount: 0
        })
        console.log(`deactivate API response: ${response}`)
        return
    }
}
