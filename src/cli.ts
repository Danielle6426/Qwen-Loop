#!/usr/bin/env node

import { Command } from 'commander';
import { LoopManager } from './core/loop-manager.js';
import { MultiProjectManager } from './core/multi-project-manager.js';
import { ConfigManager } from './core/config-manager.js';
import { QwenAgent, CustomAgent } from './agents/index.js';
import { TaskPriority, AgentType, AgentConfig } from './types.js';
import { logger, setLogLevel } from './logger.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { confirm, input, select } from '@inquirer/prompts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('qwen-loop')
  .description('Autonomous multi-agent loop for continuous code development')
  .version(packageJson.version)
  .addHelpText('before', chalk.bold.cyan('\n🤖 Qwen Loop - Autonomous Multi-Agent Loop System'))
  .addHelpText('after', `
${chalk.bold('Quick Start:')}
  ${chalk.gray('$')} qwen-loop init                 # Create configuration file
  ${chalk.gray('$')} qwen-loop start                 # Start the agent loop
  ${chalk.gray('$')} qwen-loop start --health-port 3100  # With health check server

${chalk.bold('Common Workflows:')}
  ${chalk.gray('$')} qwen-loop add-task "Fix TypeScript errors" -p high
  ${chalk.gray('$')} qwen-loop status                # View current status
  ${chalk.gray('$')} qwen-loop health                # Check system health
  ${chalk.gray('$')} qwen-loop health --json         # JSON output for scripts
  ${chalk.gray('$')} qwen-loop config                # View configuration
  ${chalk.gray('$')} qwen-loop validate              # Validate configuration

${chalk.bold('Multi-Project Mode:')}
  ${chalk.gray('$')} qwen-loop init-multi            # Create multi-project config
  ${chalk.gray('$')} qwen-loop start                 # Starts all configured projects

${chalk.bold('Documentation:')} https://github.com/tang-vu/Qwen-Loop#readme
${chalk.bold('Report Issues:')} https://github.com/tang-vu/Qwen-Loop/issues
`)
  .configureHelp({
    commandUsage: (command) => {
      const name = command.name();
      return `${chalk.cyan('qwen-loop')} ${chalk.yellow(command.arguments())} [options]`;
    },
    styleTitle: (str) => chalk.bold.underline(str),
    styleCommandText: (str) => chalk.yellow(str),
    styleCommandDescription: (str) => chalk.green(str),
    styleOptionText: (str) => chalk.cyan(str),
    styleDescriptionText: (str) => chalk.white(str),
    styleArgumentText: (str) => chalk.yellow(str),
  });

program
  .command('init')
  .description('Generate example configuration file (single project)')
  .action(() => {
    const configManager = new ConfigManager();
    const exampleConfig = configManager.generateExampleConfig();

    const configPath = join(process.cwd(), 'qwen-loop.config.json');
    writeFileSync(configPath, exampleConfig);

    console.log(`\n✓ Example configuration created at: ${configPath}`);
    console.log('\nEdit the configuration file to set up your agents, then run:');
    console.log('  qwen-loop start');
  });

program
  .command('init-multi')
  .description('Generate multi-project configuration file')
  .action(() => {
    const configManager = new ConfigManager();
    const exampleConfig = configManager.generateMultiProjectExampleConfig();

    const configPath = join(process.cwd(), 'qwen-loop.config.json');
    writeFileSync(configPath, exampleConfig);

    console.log(`\n✓ Multi-project configuration created at: ${configPath}`);
    console.log('\nEdit the projects array to add your own projects, then run:');
    console.log('  qwen-loop start');
  });

program
  .command('start')
  .description('Start the agent loop (single or multi-project)')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--auto-start', 'Automatically start processing tasks')
  .option('--health-port <port>', 'Enable HTTP health check server on specified port (default: disabled)', parseInt)
  .action(async (opts) => {
    try {
      const configManager = new ConfigManager(opts.config);
      const config = configManager.getConfig();

      // Set log level
      setLogLevel(config.logLevel);

      // Validate configuration
      const errors = configManager.validateConfig();
      if (errors.length > 0) {
        console.error('\n⚠ Configuration warnings/errors:');
        errors.forEach(err => console.error(`  - ${err}`));
        console.log('\nContinuing anyway...\n');
      }

      // Handle graceful shutdown
      const setupShutdown = async (stopFn: () => Promise<void>) => {
        process.on('SIGINT', async () => {
          console.log('\n\nShutting down...');
          await stopFn();
          process.exit(0);
        });

        process.on('SIGTERM', async () => {
          console.log('\n\nShutting down...');
          await stopFn();
          process.exit(0);
        });
      };

      // Check if multi-project mode
      if (config.projects && config.projects.length > 0) {
        console.log('\n🌐 Multi-project mode detected\n');

        const multiManager = new MultiProjectManager(config);
        await multiManager.initialize();
        await multiManager.start();

        // Start health server if requested
        let healthServer: import('./core/health-server.js').HealthServer | undefined;
        if (opts.healthPort) {
          const { HealthServer } = await import('./core/health-server.js');
          const { HealthChecker } = await import('./core/health-checker.js');
          
          // Create a health checker that aggregates all projects
          const healthChecker = new HealthChecker();
          // We'll update it periodically with multi-manager stats
          const updateHealthChecker = () => {
            const report = multiManager.getHealthReport();
            healthChecker.updateAgents(report.agents as any);
            healthChecker.updateLoopStats({
              completedTasks: report.taskThroughput.completedTasks,
              failedTasks: report.taskThroughput.failedTasks,
              totalExecutionTime: report.taskThroughput.averageExecutionTime * report.taskThroughput.completedTasks,
              maxConcurrentTasks: config.maxConcurrentTasks,
              loopInterval: config.loopInterval,
              maxRetries: config.maxRetries,
              workingDirectory: config.workingDirectory
            });
          };
          
          healthServer = new HealthServer(healthChecker, opts.healthPort);
          await healthServer.start();
          updateHealthChecker();
          
          // Update health checker every 5 seconds
          const healthUpdateInterval = setInterval(updateHealthChecker, 5000);
        }

        // Print status every 30 seconds
        const statusInterval = setInterval(() => {
          if (!multiManager.isRunningStatus()) {
            clearInterval(statusInterval);
            if (opts.healthPort) {
              // Also clear health update interval
              // This will be handled by the shutdown handler
            }
            return;
          }
          console.log(multiManager.getAllStats());
        }, 30000);

        await setupShutdown(async () => {
          if (healthServer) {
            await healthServer.stop();
          }
          await multiManager.stop();
        });

        // Keep process alive
        await new Promise(() => {});
      } else {
        // Single project mode
        const loopManager = new LoopManager(config);

        // Create and register agents
        for (const agentConfig of config.agents) {
          let agent;

          switch (agentConfig.type) {
            case AgentType.QWEN:
              agent = new QwenAgent(agentConfig);
              break;
            case AgentType.CUSTOM:
              agent = new CustomAgent(agentConfig);
              break;
            default:
              logger.error(`Unknown agent type: ${agentConfig.type}`);
              continue;
          }

          loopManager.getOrchestrator().registerAgent(agent);
        }

        logger.info(`Registered ${config.agents.length} agents`);

        // Start the loop
        await loopManager.start();

        // Start health server if requested
        let healthServer: import('./core/health-server.js').HealthServer | undefined;
        if (opts.healthPort) {
          const { HealthServer } = await import('./core/health-server.js');
          healthServer = new HealthServer(loopManager.getHealthChecker(), opts.healthPort);
          await healthServer.start();
        }

        console.log('\n🚀 Qwen Loop is running...');
        if (healthServer) {
          console.log(`📊 Health check: ${healthServer.getUrl()}`);
        }
        console.log('Press Ctrl+C to stop\n');

        // Print status every 30 seconds
        const statusInterval = setInterval(() => {
          if (!loopManager.isRunning()) {
            clearInterval(statusInterval);
            return;
          }
          const stats = loopManager.getStats();
          console.log('\n' + loopManager.getAgentStatusReport());
          console.log(loopManager.getTaskQueueStats());
        }, 30000);

        await setupShutdown(async () => {
          if (healthServer) {
            await healthServer.stop();
          }
          await loopManager.stop();
        });

        // Keep the process alive
        await new Promise(() => {});
      }
    } catch (error) {
      logger.error(`Failed to start Qwen Loop: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('add-task <description>')
  .description('Add a task to the queue')
  .option('-p, --priority <priority>', 'Task priority (low, medium, high, critical)', 'medium')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (description, opts) => {
    try {
      const priorityMap: Record<string, TaskPriority> = {
        low: TaskPriority.LOW,
        medium: TaskPriority.MEDIUM,
        high: TaskPriority.HIGH,
        critical: TaskPriority.CRITICAL
      };

      const priority = priorityMap[opts.priority.toLowerCase()] || TaskPriority.MEDIUM;

      const configManager = new ConfigManager(opts.config);
      const config = configManager.getConfig();

      // Create a temporary loop manager to add the task
      const loopManager = new LoopManager(config);

      // Create and register agents if any
      for (const agentConfig of config.agents) {
        let agent;

        switch (agentConfig.type) {
          case AgentType.QWEN:
            agent = new QwenAgent(agentConfig);
            break;
          case AgentType.CUSTOM:
            agent = new CustomAgent(agentConfig);
            break;
          default:
            logger.error(`Unknown agent type: ${agentConfig.type}`);
            continue;
        }

        loopManager.getOrchestrator().registerAgent(agent);
      }

      const task = loopManager.addTask(description, priority);

      console.log(`\n✓ Task added with ${priority} priority:`);
      console.log(`  Description: ${description}`);
      console.log(`  Task ID: ${task.id}`);
      console.log(`  Created: ${task.createdAt.toISOString()}\n`);
    } catch (error) {
      logger.error(`Failed to add task: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current status of agents and tasks')
  .option('-c, --config <path>', 'Configuration file path')
  .action((opts) => {
    console.log('\n📊 Qwen Loop Status');
    console.log('==================\n');
    console.log('Note: Start the loop first to see real-time status');
    console.log('Run: qwen-loop start\n');
  });

program
  .command('health')
  .description('Show system health status including agents, tasks, and resources')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--json', 'Output in JSON format')
  .action(async (opts) => {
    try {
      const { HealthChecker } = await import('./core/health-checker.js');
      const configManager = new ConfigManager(opts.config);
      const config = configManager.getConfig();

      const healthChecker = new HealthChecker();

      // Update with config info
      healthChecker.updateLoopStats({
        maxConcurrentTasks: config.maxConcurrentTasks,
        loopInterval: config.loopInterval,
        maxRetries: config.maxRetries,
        workingDirectory: config.workingDirectory
      });

      // Since we can't access a running instance from CLI, show a note
      console.log('\n📊 Qwen Loop Health Check');
      console.log('=========================\n');
      console.log('Note: For live metrics, the loop must be running.');
      console.log('This report shows configuration and system resource status.\n');

      // Update with agent configs
      const agentConfigs = config.agents;
      if (agentConfigs.length > 0) {
        console.log(`Configured Agents (${agentConfigs.length}):`);
        for (const agent of agentConfigs) {
          console.log(`  - ${agent.name} (${agent.type})`);
        }
        console.log('');
      }

      // Generate and display report
      const report = healthChecker.getJsonReport();

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(healthChecker.formatReportForConsole(report));
      }
    } catch (error) {
      logger.error(`Failed to generate health report: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

/**
 * Show the current configuration
 */
program
  .command('config')
  .description('Show current configuration')
  .option('-c, --config <path>', 'Configuration file path')
  .action((opts) => {
    const configManager = new ConfigManager(opts.config);
    const config = configManager.getConfig();

    console.log('\n⚙ Configuration');
    console.log('================\n');
    console.log(`Working Directory: ${config.workingDirectory}`);
    console.log(`Max Concurrent Tasks: ${config.maxConcurrentTasks}`);
    console.log(`Loop Interval: ${config.loopInterval}ms`);
    console.log(`Max Retries: ${config.maxRetries}`);
    console.log(`Log Level: ${config.logLevel}`);
    console.log(`Auto Start: ${config.enableAutoStart}`);
    console.log(`\nAgents (${config.agents.length}):`);

    for (const agent of config.agents) {
      console.log(`  - ${agent.name} (${agent.type})`);
      if (agent.model) console.log(`    Model: ${agent.model}`);
      if (agent.workingDirectory) console.log(`    Working Dir: ${agent.workingDirectory}`);
    }
    console.log('');
  });

/**
 * Validate the configuration
 */
program
  .command('validate')
  .description('Validate configuration')
  .option('-c, --config <path>', 'Configuration file path')
  .action((opts) => {
    const configManager = new ConfigManager(opts.config);
    const errors = configManager.validateConfig();

    if (errors.length === 0) {
      console.log('\n✓ Configuration is valid\n');
    } else {
      console.log('\n⚠ Configuration issues:');
      errors.forEach(err => console.error(`  - ${err}`));
      console.log('');
    }
  });

// Export for programmatic use
export { LoopManager, MultiProjectManager, ConfigManager, QwenAgent, CustomAgent };

// Parse CLI arguments
program.parse(process.argv);
