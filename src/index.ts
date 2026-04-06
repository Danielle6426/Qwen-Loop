#!/usr/bin/env node

// Main entry point for Qwen Loop
// This module re-exports all public APIs for external use.
// Import from this file to access the complete Qwen Loop SDK.

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

/**
 * Core loop manager that orchestrates the autonomous agent loop.
 * Manages task scheduling, execution, retries, and lifecycle.
 */
export {
  LoopManager,
  /**
   * Manages multiple projects, each with its own LoopManager instance.
   * Cycles through projects sequentially for multi-repository workflows.
   */
  MultiProjectManager,
  /**
   * Loads, validates, and manages Qwen Loop configuration files.
   */
  ConfigManager,
  /**
   * Registers agents and distributes tasks among them.
   */
  AgentOrchestrator,
  /**
   * Priority-based task queue (CRITICAL > HIGH > MEDIUM > LOW).
   */
  TaskQueue,
  /**
   * Analyzes project directories and autonomously generates improvement tasks.
   */
  SelfTaskGenerator,
  /**
   * Collects system metrics and generates comprehensive health reports.
   */
  HealthChecker,
  /**
   * HTTP server exposing health check endpoints (/health, /health/json, etc.).
   */
  HealthServer,
  /**
   * Agent implementation that spawns the Qwen Code CLI for task execution.
   */
  QwenAgent,
  /**
   * Agent implementation that spawns a custom CLI command for task execution.
   */
  CustomAgent,
  /**
   * Enum representing task priority levels (LOW, MEDIUM, HIGH, CRITICAL).
   */
  TaskPriority,
  /**
   * Enum representing agent types (QWEN, CUSTOM).
   */
  AgentType,
  /**
   * Structured logger singleton with colorized console and JSON file output.
   */
  logger,
  /**
   * Set the global log level for the logger instance.
   */
  setLogLevel
};

// Also export all types from types.ts
export {
  /** Enum representing agent operational states */
  AgentStatus,
  /** Enum representing task lifecycle states */
  TaskStatus,
  /** Interface for a unit of work to be executed by an agent */
  Task,
  /** Interface for agent configuration settings */
  AgentConfig,
  /** Interface for agent task execution results */
  AgentResult,
  /** Interface that all agents must implement */
  IAgent,
  /** Interface for the agent orchestration system */
  IAgentOrchestrator,
  /** Interface for the task queue system */
  ITaskQueue,
  /** Interface for the loop manager system */
  ILoopManager,
  /** Interface for loop execution statistics */
  LoopStats,
  /** Interface for multi-project configuration */
  ProjectConfig,
  /** Interface for main system configuration */
  LoopConfig,
  /** Interface for individual agent health status */
  AgentHealthStatus,
  /** Interface for system resource usage metrics */
  ResourceUsage,
  /** Interface for task throughput metrics */
  TaskThroughput,
  /** Interface for task priority and status breakdown */
  PriorityBreakdown,
  /** Interface for comprehensive system health report */
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
