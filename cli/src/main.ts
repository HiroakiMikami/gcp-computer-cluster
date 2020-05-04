#! /usr/bin/env node

/* eslint no-console: 0 */

import * as program from "commander";
import * as log4js from "log4js";
import * as process from "process";
import * as fs from "fs";
import { Cluster, Executable, setLoggerLevel } from "gcp-computer-cluster-cluster";
import { promisify } from "util";

const logger = log4js.getLogger();

async function main(): Promise<void> {
  try {
    // Define global options
    program
      .version("0.0.0")
      .option(
        "--log-level <level>",
        "One of the followings: [trace, debug, info, warn, error, fatal]",
        "info"
      )
      .option(
        "--gcloud-path <path>",
        "The path of gcloud command",
        "gcloud"
      )
      .option(
        "--kubectl-path <path>",
        "The path of kubectl command",
        "kubectl"
      );
    // Define command-specific options
    program
      .command("create <config>")
      .action(async (config, cmd) => {
        logger.level = cmd.parent.logLevel
        setLoggerLevel(cmd.parent.logLevel)
        const cfg = await promisify(fs.readFile)(config, "utf-8")
        const gcloud = new Executable(cmd.parent.gcloudPath)
        const kubectl = new Executable(cmd.parent.kubectlPath)
        const cluster = new Cluster(
          JSON.parse(cfg),
          async (args) => {
            await gcloud.execute(args)
            return
          },
          async (args) => {
            await kubectl.execute(args)
            return
          })
        await cluster.create()
      });
    program
      .command("delete <config>")
      .action(async (config, cmd) => {
        logger.level = cmd.parent.logLevel
        setLoggerLevel(cmd.parent.logLevel)
        const cfg = await promisify(fs.readFile)(config, "utf-8")
        const gcloud = new Executable(cmd.parent.gcloudPath)
        const kubectl = new Executable(cmd.parent.kubectlPath)
        const cluster = new Cluster(
          JSON.parse(cfg),
          async (args) => {
            await gcloud.execute(args)
            return
          },
          async (args) => {
            await kubectl.execute(args)
            return
          })
        await cluster.delete()
      });
    program.parse(process.argv);
  } catch (error) {
    logger.error(error);
  }
}

main();
