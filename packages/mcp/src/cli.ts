#!/usr/bin/env node
import { Command } from 'commander';
import { runServer } from './server.js';
import { runInit, runDoctor } from './init-doctor.js';

const program = new Command();

program
  .name('pinmark')
  .description('Pinmark AI Agent Bridge & Visual Feedback Suite')
  .version('1.6.0');;

program
  .command('server')
  .description('Start the MCP stdio server and HTTP bridge')
  .option('-p, --port <number>', 'HTTP server port', '4747')
  .action(async (options) => {
    try {
      await runServer(parseInt(options.port, 10));
    } catch (e) {
      console.error('Fatal error:', e);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Automatically detect installed AI agents and configure Pinmark MCP server')
  .action(async () => {
    try {
      await runInit();
    } catch (e) {
      console.error('Init error:', e);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Inspect environment, agent configurations, and HTTP bridge health')
  .option('-p, --port <number>', 'HTTP bridge port to check', '4747')
  .action(async (options) => {
    try {
      await runDoctor(parseInt(options.port, 10));
    } catch (e) {
      console.error('Doctor error:', e);
      process.exit(1);
    }
  });

program.parse();
