#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { ValkeyStack } from "../lib/valkey-stack.js";

const app = new App();
new ValkeyStack(app, "ValkeyStack", {});