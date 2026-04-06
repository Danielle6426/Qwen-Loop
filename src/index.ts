#!/usr/bin/env node

// Main entry point for Qwen Loop
import { LoopManager } from './core/loop-manager.js';
import { MultiProjectManager } from './core/multi-project-manager.js';
import { ConfigManager } from './core/config-manager.js';
import { AgentOrchestrator } from './core/orchestrator.js';
import { TaskQueue } from './core/task-queue.js';
import { SelfTaskGenerator } from './core/self-task-generator.js';
import { HealthChecker } from './core/health-checker.js';
import { HealthServer } from './core/health-server.js';
import { QwenAgent, CustomAgent } from './agents/index.js';
import { TaskPriority, AgentType } from './types.js';
import { logger, setLogLevel } from './logger.js';

export {
  LoopManager,
  MultiProjectManager,
  ConfigManager,
  AgentOrchestrator,
  TaskQueue,
  SelfTaskGenerator,
  HealthChecker,
  HealthServer,
  QwenAgent,
  CustomAgent,
  TaskPriority,
  AgentType,
  logger,
  setLogLevel
};

// Also export all types from types.ts
export {
  AgentStatus,
  TaskStatus,
  Task,
  AgentConfig,
  AgentResult,
  IAgent,
  IAgentOrchestrator,
  ITaskQueue,
  ILoopManager,
  LoopStats,
  ProjectConfig,
  LoopConfig,
  AgentHealthStatus,
  ResourceUsage,
  TaskThroughput,
  PriorityBreakdown,
  HealthReport
} from './types.js';

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
  health            Show system health status
  config            Show configuration
  validate          Validate configuration

Examples:
  qwen-loop init
  qwen-loop start
  qwen-loop start --health-port 3100
  qwen-loop add-task "Fix all TypeScript errors" --priority high
  qwen-loop status
  qwen-loop health
  qwen-loop health --json
`);
}
