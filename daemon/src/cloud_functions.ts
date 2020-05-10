import * as container from "@google-cloud/container";
import { GoogleAuth } from "google-auth-library";
import { ClusterConfig } from "./types";
import { createKubernetesClientInGcp } from "./kubernetes_client";
import { GkeCluster } from "./gke_cluster";

export async function deactivationPubSub(event: {data: string}): Promise<void> {
    const pubsubMessage = event.data;
    const config: ClusterConfig = JSON.parse(Buffer.from(pubsubMessage, "base64").toString());
    console.log(`[begin] deactivationPubSub: ${JSON.stringify(config)}`)
    const gkeClient = new container.v1.ClusterManagerClient()
    const googleAuthClient = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" })
    const k8sClient = await createKubernetesClientInGcp(config, gkeClient, googleAuthClient)
    const cluster = new GkeCluster(config, gkeClient, k8sClient)

    if (await cluster.canBeDeactivated()) {
        console.log(`Deactivate the cluster`)
        await cluster.deactivate()
    } else {
        console.log(`Skip deactivation because the cluster is used`)
    }
    console.log(`[end] deactivationPubSub`)
    return;
}
