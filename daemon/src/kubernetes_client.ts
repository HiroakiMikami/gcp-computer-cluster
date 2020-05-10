/*
 * This file includes the software (function/source code) from 
 * https://github.com/h-r-k-matsumoto/cloud-function-gke, licensed under Apache-2.0 License.
 *
 * Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */
import * as k8s from "@kubernetes/client-node"
import { ClusterConfig, GkeClient, getName, GoogleAuthClient } from "./types"

export async function createKubernetesClientInGcp(
  config: ClusterConfig, gkeClient: GkeClient, googleAuthClient: GoogleAuthClient): Promise<k8s.CoreV1Api> {

  if (config.project == null) {
    config.project = await gkeClient.getProjectId()
  }

  /* getCluster */
  console.log(`Get information about the GKE cluster`)
  const cluster = (await gkeClient.getCluster({name: await getName(config, gkeClient)}))[0]

  /* getToken */
  console.log(`Get an access token to access the cluster`)
  const token = await googleAuthClient.getAccessToken()

  /* getKubernetesClient */
  console.log(`Create a kubernetes client`)
  const clusterFullName = `gke_${config.project}_${config.zone}_${config.clusterName}`
  const kubeConfig = {
    apiVersion: "v1",
    kind: "Config",
    clusters: [
      {
        cluster: {
          skipTLSVerify: true,
          server: `https://${cluster.endpoint}`
        },
        name: clusterFullName
      }
    ],
    contexts: [
      {
        context: {
          cluster: clusterFullName,
          user: clusterFullName
        },
        name: clusterFullName
      }
    ],
    currentContext: clusterFullName,
    users: [
      {
        name: clusterFullName,
        user: {token}
      }
    ]
  }
  const kc = new k8s.KubeConfig();
  kc.loadFromOptions(kubeConfig);

  return kc.makeApiClient(k8s.CoreV1Api)
}
