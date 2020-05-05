import * as container from "@google-cloud/container"
import * as protosTypes from "@google-cloud/container/build/protos/protos"
import * as log4js from "log4js"

const logger = log4js.getLogger()
const DEFAULT_NODE_POOL_NAME = "default-pool"

interface Client {
    getProjectId(): Promise<string>;
    setNodePoolSize(request: protosTypes.google.container.v1.ISetNodePoolSizeRequest): Promise<[protosTypes.google.container.v1.IOperation, protosTypes.google.container.v1.ISetNodePoolSizeRequest | undefined, {} | undefined]>;
}

export class GkeCluster {
    constructor(private clusterName: string, private zone: string, private project?: string,
                private client: Client = new container.v1.ClusterManagerClient()) {
    }
    private async getName(): Promise<string> {
        if (this.project == null) {
            this.project = await this.client.getProjectId()
        }
        return `projects/${this.project}/zones/${this.zone}/clusters/${this.clusterName}/nodePools/${DEFAULT_NODE_POOL_NAME}`
    }

    public async activate(): Promise<void> {
        const [response] = await this.client.setNodePoolSize({
            name: await this.getName(),
            nodeCount: 1
        })
        logger.debug(`activate API response: ${response}`)
        return
    }

    public async deactivate(): Promise<void> {
        const [response] = await this.client.setNodePoolSize({
            name: await this.getName(),
            nodeCount: 0
        })
        logger.debug(`deactivate API response: ${response}`)
        return
    }
}
