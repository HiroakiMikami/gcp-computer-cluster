#! /usr/bin/env node

/* eslint no-console: 0 */

import * as program from "commander";
import * as log4js from "log4js";
import * as process from "process";
import * as fs from "fs";
import * as deploy from "gcp-computer-cluster-deploy";
import * as manage from "gcp-computer-cluster-manage";
import { promisify } from "util";

const logger = log4js.getLogger();

function setLoggerLevel(level: string) {
  logger.level = level
  deploy.setLoggerLevel(level)
  manage.setLoggerLevel(level)
}

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
        const cfg = await promisify(fs.readFile)(config, "utf-8")
        setLoggerLevel(cmd.parent.logLevel)
        const gcloud = new deploy.Executable(cmd.parent.gcloudPath)
        const kubectl = new deploy.Executable(cmd.parent.kubectlPath)
        const cluster = new deploy.Cluster(
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
        setLoggerLevel(cmd.parent.logLevel)
        const cfg = await promisify(fs.readFile)(config, "utf-8")
        const gcloud = new deploy.Executable(cmd.parent.gcloudPath)
        const kubectl = new deploy.Executable(cmd.parent.kubectlPath)
        const cluster = new deploy.Cluster(
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
      program
      .command("activate <config>")
      .action(async (config, cmd) => {
        setLoggerLevel(cmd.parent.logLevel)
        const cfgStr = await promisify(fs.readFile)(config, "utf-8")
        const cfg: deploy.ClusterConfig = JSON.parse(cfgStr)
        const cluster = new manage.GkeCluster(cfg.name, cfg.zone)
        await cluster.activate()
      });
      program
      .command("deactivate <config>")
      .action(async (config, cmd) => {
        setLoggerLevel(cmd.parent.logLevel)
        const cfgStr = await promisify(fs.readFile)(config, "utf-8")
        const cfg: deploy.ClusterConfig = JSON.parse(cfgStr)
        const cluster = new manage.GkeCluster(cfg.name, cfg.zone)
        await cluster.deactivate()
      });
    program.parse(process.argv);
  } catch (error) {
    logger.error(error);
  }
}

main();
