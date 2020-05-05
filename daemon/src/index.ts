export { GkeCluster } from "./gke_cluster"

import * as log4js from "log4js"

export function setLoggerLevel(level: string) {
    log4js.getLogger().level = level
}
