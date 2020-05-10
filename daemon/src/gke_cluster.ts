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
        console.log(`Activate the cluster`)
        const [response] = await this.gkeClient.setNodePoolSize({
            name: await this.getDefaultNodePoolName(),
            nodeCount: 1
        })
        console.log(`Finish activation: ${response.statusMessage}`)
        return
    }

    public async deactivate(): Promise<void> {
        console.log(`Dectivate the cluster`)
        const [response] = await this.gkeClient.setNodePoolSize({
            name: await this.getDefaultNodePoolName(),
            nodeCount: 0
        })
        console.log(`Finish deactivation: ${response.statusMessage}`)
        return
    }
    
    public async canBeDeactivated(): Promise<boolean> {
        console.log(`Find the runing or pending pods`)
        console.log(`Get the list of all namespaces`)
        const response = (await this.kubectlClient.listNamespace()).body.items
        const namespaces = new Set(response.map(namespace => {
            return namespace.metadata.name
        }))
        namespaces.delete("kube-system")
        namespaces.delete("kube-public")
        namespaces.delete("kube-node-lease")
        console.log(`Namespaces: ${JSON.stringify(namespaces)}`)

        let cnt = 0
        for (const namespace of Array.from(namespaces)) {
            const pods = (await this.kubectlClient.listNamespacedPod(namespace)).body.items
            const num = pods.filter(pod => {
                return pod.status.phase === "Running" || pod.status.phase === "Pending"
            }).length
            console.log(`The number of running or pendings pods in ${namespace}: ${num}`)
            cnt += num
        }
        console.log(`The number of running or pendings pods: ${cnt}`)
        return cnt === 0
    }
}
