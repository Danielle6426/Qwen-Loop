#!/usr/bin/env node

// Main entry point for Qwen Loop
import { LoopManager } from './core/loop-manager.js';
import { MultiProjectManager } from './core/multi-project-manager.js';
import { ConfigManager } from './core/config-manager.js';
import { QwenAgent, CustomAgent } from './agents/index.js';
import { TaskPriority, AgentType } from './types.js';
import { logger, setLogLevel } from './logger.js';

export {
  LoopManager,
  MultiProjectManager,
  ConfigManager,
  QwenAgent,
  CustomAgent,
  TaskPriority,
  AgentType,
  logger,
  setLogLevel
};

// If run directly (not imported), show help
if (process.argv[1] && (process.argv[1].includes('index.ts') || process.argv[1].includes('index.js'))) {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██████╗ ██████╗ ██████╗ ███████╗    ██████╗ ███████╗   ║
║  ██╔════╝██╔═══██╗██╔══██╗██╔════╝    ██╔══██╗██╔════╝   ║
║  ██║     ██║   ██║██║  ██║█████╗      ██████╔╝█████╗     ║
║  ██║     ██║   ██║██║  ██║██╔══╝      ██╔══██╗██╔══╝     ║
║  ╚██████╗╚██████╔╝██████╔╝███████╗    ██║  ██║███████╗   ║
║   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚═╝  ╚═╝╚══════╝   ║
║                                                           ║
║         Autonomous Multi-Agent Loop System                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

Usage:
  npx tsx src/cli.ts <command>

Commands:
  init              Generate example configuration
  start             Start the agent loop
  add-task <desc>   Add a task to the queue
  status            Show current status
  config            Show configuration
  validate          Validate configuration

Examples:
  qwen-loop init
  qwen-loop start
  qwen-loop add-task "Fix all TypeScript errors" --priority high
  qwen-loop status
`);
}
