import * as protosTypes from "@google-cloud/container/build/protos/protos"

import { V1PodList, V1NamespaceList } from "@kubernetes/client-node";

export interface ClusterConfig {
    clusterName: string;
    zone: string;
    project?: string;
}

export interface GkeClient {
    getProjectId(): Promise<string>;
    getCluster(request: protosTypes.google.container.v1.IGetClusterRequest): Promise<[protosTypes.google.container.v1.ICluster, protosTypes.google.container.v1.IGetClusterRequest | undefined, {} | undefined]>;
    setNodePoolSize(request: protosTypes.google.container.v1.ISetNodePoolSizeRequest): Promise<[protosTypes.google.container.v1.IOperation, protosTypes.google.container.v1.ISetNodePoolSizeRequest | undefined, {} | undefined]>;
}
export interface KubectlClient {
    listNamespace(): Promise<{body: V1NamespaceList}>;
    listNamespacedPod(namespace: string): Promise<{body: V1PodList}>;
}

export async function getName(config: ClusterConfig, client: GkeClient): Promise<string> {
    if (config.project == null) {
        config.project = await client.getProjectId()
    }
    return `projects/${config.project}/zones/${config.zone}/clusters/${config.clusterName}`
}
