#! /usr/bin/env node

/* eslint no-console: 0 */

import * as program from "commander";
import * as log4js from "log4js";
import * as process from "process";
import * as fs from "fs";
import { Executable } from "./executable";
import { Cluster } from "./cluster";
import { promisify } from "util";
import commander = require("commander");

const logger = log4js.getLogger();

async function setup(configFile: string, cmd: commander.Command): Promise<Cluster> {
  logger.level = cmd.parent.logLevel
  const cfg = await promisify(fs.readFile)(configFile, "utf-8")
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
    return cluster
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
      .option("--without-shared-components")
      .action(async (config, cmd) => {
        const cluster = await setup(config, cmd)
        if (!cmd.withoutSharedComponents) {
          await cluster.createSharedComponents()
        }
        await cluster.create()
      });
    program
      .command("delete <config>")
      .option("--without-shared-components")
      .action(async (config, cmd) => {
        const cluster = await setup(config, cmd)
        await cluster.delete()
        if (!cmd.withoutSharedComponents) {
          await cluster.deleteSharedComponents()
        }
      });
      program
      .command("activate <config>")
      .action(async (config, cmd) => {
        const cluster = await setup(config, cmd)
        await cluster.activate()
      });
      program
      .command("deactivate <config>")
      .action(async (config, cmd) => {
        const cluster = await setup(config, cmd)
        await cluster.deactivate()
      });
    program.parse(process.argv);
  } catch (error) {
    logger.error(error);
  }
}

main();
