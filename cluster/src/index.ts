export { Cluster, ClusterConfig, Accelerator, NodePool } from "./cluster"
export { Executable } from "./executable"

import * as log4js from "log4js"

export function setLoggerLevel(level: string) {
    log4js.getLogger().level = level
}
