import { KubectlClient, GkeClient, ClusterConfig, getName } from "./types"

const DEFAULT_NODE_POOL_NAME = "default-pool"

export class GkeCluster {
    constructor(private config: ClusterConfig, private gkeClient: GkeClient,
                private kubectlClient: KubectlClient) {
    }
    private async getDefaultNodePoolName(): Promise<string> {
        return `${await getName(this.config, this.gkeClient)}/nodePools/${DEFAULT_NODE_POOL_NAME}`
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
    
    public async canBeDeactivated(): Promise<boolean> {
        const response = (await this.kubectlClient.listNamespace()).body.items
        const namespaces = new Set(response.map(namespace => {
            return namespace.metadata.name
        }))
        namespaces.delete("kube-system")
        namespaces.delete("kube-public")
        namespaces.delete("kube-node-lease")

        let cnt = 0
        for (const namespace of Array.from(namespaces)) {
            const pods = (await this.kubectlClient.listNamespacedPod(namespace)).body.items
            cnt += pods.filter(pod => {
                return pod.status.phase === "Running" || pod.status.phase === "Pending"
            }).length
        }
        return cnt === 0
    }
}
