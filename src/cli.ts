#!/usr/bin/env node

import { Command, Help, Option } from 'commander';
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

// Setup global error handlers
process.on('uncaughtException', (error) => {
  console.error(`\n${chalk.red('✖ Error:')} ${error.message || 'An unexpected error occurred'}`);
  console.error(chalk.gray('\nThis is likely a bug. Please report it at:'));
  console.error(chalk.cyan('  https://github.com/tang-vu/Qwen-Loop/issues\n'));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error(`\n${chalk.red('✖ Error:')} ${message}`);
  console.error(chalk.gray('\nThis is likely a bug. Please report it at:'));
  console.error(chalk.cyan('  https://github.com/tang-vu/Qwen-Loop/issues\n'));
  process.exit(1);
});

const program = new Command();

program
  .name('qwen-loop')
  .description('Autonomous multi-agent loop for continuous code development')
  .version(packageJson.version, '-V, --version', 'Show Qwen Loop version number')
  .addHelpText('beforeAll', () => {
    return `\n${chalk.bold.cyan('🤖 Qwen Loop')} ${chalk.gray(`v${packageJson.version}`)} - Autonomous Multi-Agent Loop System\n`;
  })
  .configureHelp({
    styleTitle: (str) => chalk.bold.underline(str),
    styleCommandText: (str) => chalk.yellow(str),
    styleCommandDescription: (str) => chalk.green(str),
    styleOptionText: (str) => chalk.cyan(str),
    styleDescriptionText: (str) => chalk.white(str),
    styleArgumentText: (str) => chalk.yellow(str),
  })
  .addHelpText('after', `
${chalk.bold('💡 Tips:')}
  • Run ${chalk.yellow('qwen-loop init')} to create your first configuration file
  • Use ${chalk.yellow('qwen-loop validate')} to check your configuration for issues
  • Add ${chalk.yellow('--json')} to health and status commands for script-friendly output
  • Press ${chalk.yellow('Ctrl+C')} to gracefully stop the agent loop

${chalk.bold('📚 Resources:')}
  Documentation  ${chalk.cyan('https://github.com/tang-vu/Qwen-Loop#readme')}
  Report Issues  ${chalk.cyan('https://github.com/tang-vu/Qwen-Loop/issues')}
`);

/**
 * Helper: Display error message with optional suggestion
 */
function displayError(message: string, suggestion?: string): void {
  console.error(`\n${chalk.red('✖ Error:')} ${message}`);
  if (suggestion) {
    console.error(chalk.gray(`\n💡 Suggestion: ${suggestion}`));
  }
  console.error('');
}

/**
 * Helper: Display success message
 */
function displaySuccess(message: string): void {
  console.log(`\n${chalk.green('✓')} ${message}\n`);
}

/**
 * Helper: Display warning message
 */
function displayWarning(message: string): void {
  console.log(`\n${chalk.yellow('⚠ Warning:')} ${message}\n`);
}

/**
 * Helper: Check if config file exists, display helpful error if not
 */
function requireConfig(configManager: ConfigManager): void {
  const config = configManager.getConfig();
  const configPath = configManager['configPath'];
  
  // If no agents configured and no projects, likely config file doesn't exist
  if ((!config.agents || config.agents.length === 0) && 
      (!config.projects || config.projects.length === 0) &&
      config.workingDirectory === process.cwd()) {
    displayError(
      `Configuration file not found at ${configPath}`,
      `Run 'qwen-loop init' to create a configuration file, or specify one with --config <path>`
    );
    process.exit(1);
  }
}

program
  .command('init')
  .description('Create configuration file (single project mode)')
  .option('--interactive', 'Use interactive mode to configure settings')
  .option('-f, --force', 'Overwrite existing configuration file')
  .action(async (opts) => {
    try {
      const configPath = join(process.cwd(), 'qwen-loop.config.json');
      
      // Check if config file already exists
      if (existsSync(configPath) && !opts.force) {
        const overwrite = await confirm({
          message: chalk.yellow(`Configuration file already exists at ${configPath}. Overwrite?`),
          default: false
        });
        
        if (!overwrite) {
          console.log(chalk.cyan('\nℹ Keeping existing configuration file.'));
          console.log(chalk.gray(`   Use --force to overwrite: qwen-loop init --force\n`));
          return;
        }
      }

      let configData: string;

      if (opts.interactive) {
        console.log(`\n${chalk.bold.cyan('🔧 Interactive Configuration Setup')}`);
        console.log(chalk.gray('Answer the following questions to set up your project\n'));

        // Ask for working directory
        const workingDir = await input({
          message: chalk.white('Working directory (press Enter for current dir):'),
          default: './project',
          validate: (value) => {
            if (value.trim() === '') return true;
            return true;
          }
        });

        // Ask for agent type
        const agentType = await select({
          message: chalk.white('Select agent type:'),
          choices: [
            { name: 'Qwen - Use Qwen AI model', value: AgentType.QWEN },
            { name: 'Custom - Custom agent implementation', value: AgentType.CUSTOM },
          ]
        });

        // Ask for agent name
        const agentName = await input({
          message: chalk.white('Agent name:'),
          default: agentType === AgentType.QWEN ? 'qwen-dev' : 'custom-agent',
          validate: (value) => value.trim() ? true : 'Agent name cannot be empty'
        });

        // Ask for max concurrent tasks
        const maxConcurrentStr = await input({
          message: chalk.white('Max concurrent tasks (1-10):'),
          default: '1',
          validate: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1 || num > 10) {
              return 'Please enter a number between 1 and 10';
            }
            return true;
          }
        });

        // Ask for loop interval
        const intervalStr = await input({
          message: chalk.white('Loop interval in milliseconds (1000-60000):'),
          default: '5000',
          validate: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1000 || num > 60000) {
              return 'Please enter a number between 1000 and 60000';
            }
            return true;
          }
        });

        // Ask for max retries
        const retriesStr = await input({
          message: chalk.white('Max retries on failure (0-10):'),
          default: '2',
          validate: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 0 || num > 10) {
              return 'Please enter a number between 0 and 10';
            }
            return true;
          }
        });

        // Generate config based on answers
        const configManager = new ConfigManager();
        const exampleConfig = configManager.generateExampleConfig();
        const config = JSON.parse(exampleConfig);

        config.agents[0].name = agentName;
        config.agents[0].type = agentType;
        config.workingDirectory = workingDir;
        config.agents[0].workingDirectory = workingDir;
        config.maxConcurrentTasks = parseInt(maxConcurrentStr);
        config.loopInterval = parseInt(intervalStr);
        config.maxRetries = parseInt(retriesStr);

        configData = JSON.stringify(config, null, 2);
      } else {
        // Non-interactive: use default example config
        const configManager = new ConfigManager();
        configData = configManager.generateExampleConfig();
      }

      writeFileSync(configPath, configData);
      displaySuccess(`Configuration file created at ${chalk.cyan(configPath)}`);
      
      console.log(chalk.bold('\n📝 Next steps:'));
      console.log(chalk.gray('  1. Edit the configuration file if needed:'));
      console.log(chalk.cyan(`     ${configPath}`));
      console.log(chalk.gray('  2. Validate your configuration:'));
      console.log(chalk.yellow('     qwen-loop validate'));
      console.log(chalk.gray('  3. Start the agent loop:'));
      console.log(chalk.yellow('     qwen-loop start\n'));
    } catch (error) {
      if (error instanceof Error && error.message === 'User force closed the prompt') {
        console.log(chalk.gray('\n\n⚠ Configuration cancelled by user.\n'));
        process.exit(0);
      }
      const message = error instanceof Error ? error.message : String(error);
      displayError(`Failed to create configuration file: ${message}`, 'Check that you have write permissions in the current directory');
      process.exit(1);
    }
  });

program
  .command('init-multi')
  .description('Create multi-project configuration file')
  .option('-f, --force', 'Overwrite existing configuration file')
  .action(async (opts) => {
    try {
      const configPath = join(process.cwd(), 'qwen-loop.config.json');
      
      // Check if config file already exists
      if (existsSync(configPath) && !opts.force) {
        const overwrite = await confirm({
          message: chalk.yellow(`Configuration file already exists at ${configPath}. Overwrite?`),
          default: false
        });
        
        if (!overwrite) {
          console.log(chalk.cyan('\nℹ Keeping existing configuration file.'));
          console.log(chalk.gray(`   Use --force to overwrite: qwen-loop init-multi --force\n`));
          return;
        }
      }

      const configManager = new ConfigManager();
      const exampleConfig = configManager.generateMultiProjectExampleConfig();

      writeFileSync(configPath, exampleConfig);
      displaySuccess(`Multi-project configuration file created at ${chalk.cyan(configPath)}`);
      
      console.log(chalk.bold('\n📝 Next steps:'));
      console.log(chalk.gray('  1. Edit the projects array in the configuration file:'));
      console.log(chalk.cyan(`     ${configPath}`));
      console.log(chalk.gray('  2. Validate your configuration:'));
      console.log(chalk.yellow('     qwen-loop validate'));
      console.log(chalk.gray('  3. Start the agent loop for all projects:'));
      console.log(chalk.yellow('     qwen-loop start\n'));
    } catch (error) {
      if (error instanceof Error && error.message === 'User force closed the prompt') {
        console.log(chalk.gray('\n\n⚠ Configuration cancelled by user.\n'));
        process.exit(0);
      }
      const message = error instanceof Error ? error.message : String(error);
      displayError(`Failed to create configuration file: ${message}`, 'Check that you have write permissions in the current directory');
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start the agent loop (auto-detects single or multi-project mode)')
  .option('-c, --config <path>', 'Path to configuration file (default: ./qwen-loop.config.json)')
  .option('--auto-start', 'Automatically start processing tasks')
  .option('--health-port <port>', 'Enable HTTP health check server on specified port', parseInt)
  .action(async (opts) => {
    try {
      const configManager = new ConfigManager(opts.config);
      const config = configManager.getConfig();

      // Check if config file was loaded or using defaults
      if (!existsSync(configManager['configPath'])) {
        displayError(
          `Configuration file not found at ${configManager['configPath']}`,
          `Run 'qwen-loop init' first to create a configuration file`
        );
        process.exit(1);
      }

      // Set log level
      setLogLevel(config.logLevel);

      // Validate configuration
      const errors = configManager.validateConfig();
      if (errors.length > 0) {
        console.error(`\n${chalk.yellow('⚠ Configuration Issues:')} (${errors.length} found)`);
        errors.forEach(err => console.error(`  ${chalk.red('•')} ${err}`));
        
        // Ask user if they want to continue
        try {
          const shouldContinue = await confirm({
            message: chalk.yellow('\nDo you want to continue anyway? (not recommended)'),
            default: false
          });
          
          if (!shouldContinue) {
            console.log(chalk.cyan('\nℹ Aborted. Fix the issues above and try again.\n'));
            console.log(chalk.gray('💡 Tips:'));
            console.log(chalk.gray('  • Run "qwen-loop validate" for detailed validation output'));
            console.log(chalk.gray('  • Run "qwen-loop init" to create a fresh configuration\n'));
            process.exit(0);
          }
          console.log(chalk.yellow('\n⚠ Continuing with warnings...\n'));
        } catch (error) {
          // User cancelled (Ctrl+C)
          console.log(chalk.gray('\n\n⚠ Aborted.\n'));
          process.exit(0);
        }
      }

      // Handle graceful shutdown
      const setupShutdown = async (stopFn: () => Promise<void>) => {
        process.on('SIGINT', async () => {
          console.log(chalk.yellow('\n\n⏹ Shutting down gracefully...'));
          await stopFn();
          console.log(chalk.green('✓ Shutdown complete.\n'));
          process.exit(0);
        });

        process.on('SIGTERM', async () => {
          console.log(chalk.yellow('\n\n⏹ Shutting down gracefully...'));
          await stopFn();
          console.log(chalk.green('✓ Shutdown complete.\n'));
          process.exit(0);
        });
      };

      // Check if multi-project mode
      if (config.projects && config.projects.length > 0) {
        console.log(`\n${chalk.bold.cyan('🌐 Multi-Project Mode')}\n`);

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

        console.log(`\n${chalk.green('🚀 Qwen Loop Started Successfully!')}`);
        if (healthServer) {
          console.log(`${chalk.blue('📊 Health check:')} ${chalk.cyan(healthServer.getUrl())}`);
        }
        console.log(chalk.gray('Press Ctrl+C to stop the loop\n'));

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
      const message = error instanceof Error ? error.message : String(error);
      
      // Provide specific error messages for common issues
      if (message.includes('ENOENT') || message.includes('not found')) {
        displayError(
          `Failed to start: Configuration or dependency missing`,
          `Run 'qwen-loop validate' to check your configuration`
        );
      } else if (message.includes('EADDRINUSE')) {
        displayError(
          `Port is already in use`,
          `Use a different port: qwen-loop start --health-port <different-port>`
        );
      } else {
        displayError(`Failed to start Qwen Loop: ${message}`);
      }
      process.exit(1);
    }
  });

program
  .command('add-task <description>')
  .description('Add a task to the queue')
  .option('-p, --priority <priority>', 'Task priority: low, medium, high, critical', 'medium')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (description, opts) => {
    try {
      const priorityMap: Record<string, TaskPriority> = {
        low: TaskPriority.LOW,
        medium: TaskPriority.MEDIUM,
        high: TaskPriority.HIGH,
        critical: TaskPriority.CRITICAL
      };

      // Validate priority
      const priorityKey = opts.priority.toLowerCase();
      if (!priorityMap[priorityKey]) {
        displayError(
          `Invalid priority: ${opts.priority}`,
          `Valid priorities are: low, medium, high, critical`
        );
        process.exit(1);
      }

      const priority = priorityMap[priorityKey];

      const configManager = new ConfigManager(opts.config);
      requireConfig(configManager);
      
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

      console.log(`\n${chalk.green('✓ Task Added Successfully')}`);
      console.log(chalk.gray('─').repeat(40));
      console.log(`  ${chalk.bold('Description:')} ${description}`);
      console.log(`  ${chalk.bold('Priority:')}    ${chalk.cyan(priority)}`);
      console.log(`  ${chalk.bold('Task ID:')}     ${task.id}`);
      console.log(`  ${chalk.bold('Created:')}     ${task.createdAt.toISOString()}`);
      console.log(chalk.gray('─').repeat(40));
      console.log(chalk.gray('\n💡 Start processing with: qwen-loop start\n'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      displayError(`Failed to add task: ${message}`, 'Make sure your configuration file is valid');
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current status of agents and tasks')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--json', 'Output in JSON format')
  .action(async (opts) => {
    try {
      const configManager = new ConfigManager(opts.config);
      
      // Check if config exists
      if (!existsSync(configManager['configPath'])) {
        displayError(
          'No configuration file found',
          'Run "qwen-loop init" to create a configuration file first'
        );
        process.exit(1);
      }

      const config = configManager.getConfig();

      console.log(`\n${chalk.bold.cyan('📊 Qwen Loop Status')}`);
      console.log(chalk.gray('═'.repeat(50)) + '\n');

      // Show configuration summary
      console.log(chalk.bold('Configuration:'));
      console.log(`  Config File:  ${chalk.cyan(configManager['configPath'])}`);
      console.log(`  Working Dir:  ${config.workingDirectory}`);
      console.log(`  Agents:       ${config.agents.length}`);
      console.log(`  Max Tasks:    ${config.maxConcurrentTasks}`);
      console.log(`  Interval:     ${config.loopInterval}ms`);
      console.log(`  Max Retries:  ${config.maxRetries}`);

      if (config.projects && config.projects.length > 0) {
        console.log(`\n${chalk.bold('Projects:')} ${config.projects.length}`);
        config.projects.forEach((project: any) => {
          console.log(`  • ${chalk.cyan(project.name)} - ${project.workingDirectory}`);
        });
      }

      if (config.agents.length > 0) {
        console.log(`\n${chalk.bold('Agents:')}`);
        config.agents.forEach((agent: any) => {
          console.log(`  • ${chalk.cyan(agent.name)} (${chalk.yellow(agent.type)})`);
          if (agent.model) console.log(`    Model: ${agent.model}`);
        });
      }

      console.log(chalk.gray('\nℹ For live task status, the loop must be running.'));
      console.log(chalk.gray('  Start with: qwen-loop start\n'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      displayError(`Failed to show status: ${message}`);
      process.exit(1);
    }
  });

program
  .command('health')
  .description('Show system health status including agents, tasks, and resources')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--json', 'Output in JSON format for scripts')
  .action(async (opts) => {
    try {
      const { HealthChecker } = await import('./core/health-checker.js');
      const configManager = new ConfigManager(opts.config);
      
      if (!existsSync(configManager['configPath'])) {
        displayError(
          'No configuration file found',
          'Run "qwen-loop init" to create a configuration file first'
        );
        process.exit(1);
      }
      
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
      console.log(`\n${chalk.bold.cyan('📊 Qwen Loop Health Check')}`);
      console.log(chalk.gray('═'.repeat(50)) + '\n');
      console.log(chalk.yellow('ℹ Note:'));
      console.log(chalk.gray('  For live metrics, the loop must be running.'));
      console.log(chalk.gray('  This report shows configuration and system resource status.\n'));

      // Update with agent configs
      const agentConfigs = config.agents;
      if (agentConfigs.length > 0) {
        console.log(chalk.bold(`Configured Agents (${agentConfigs.length}):`));
        for (const agent of agentConfigs) {
          console.log(`  ${chalk.green('•')} ${chalk.cyan(agent.name)} (${chalk.yellow(agent.type)})`);
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
      const message = error instanceof Error ? error.message : String(error);
      displayError(`Failed to generate health report: ${message}`);
      process.exit(1);
    }
  });

/**
 * Show the current configuration
 */
program
  .command('config')
  .description('Show current configuration details')
  .option('-c, --config <path>', 'Path to configuration file (default: ./qwen-loop.config.json)')
  .option('--json', 'Output in JSON format')
  .action(async (opts) => {
    try {
      const configManager = new ConfigManager(opts.config);
      const configPath = configManager['configPath'];

      if (!existsSync(configPath)) {
        displayError(
          `Configuration file not found at ${configPath}`,
          `Run 'qwen-loop init' to create a configuration file`
        );
        process.exit(1);
      }

      const config = configManager.getConfig();

      if (opts.json) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      console.log(`\n${chalk.bold.cyan('⚙ Configuration Details')}`);
      console.log(chalk.gray('═'.repeat(50)) + '\n');
      console.log(chalk.bold('General:'));
      console.log(`  Config File:      ${chalk.cyan(configPath)}`);
      console.log(`  Working Directory: ${config.workingDirectory}`);
      console.log(`  Max Concurrent:    ${config.maxConcurrentTasks}`);
      console.log(`  Loop Interval:     ${config.loopInterval}ms`);
      console.log(`  Max Retries:       ${config.maxRetries}`);
      console.log(`  Log Level:         ${config.logLevel}`);
      console.log(`  Auto Start:        ${config.enableAutoStart}`);
      console.log(`  Max Loop Iterations: ${config.maxLoopIterations || 'unlimited'}`);
      console.log(`  Self Task Gen:     ${config.enableSelfTaskGeneration ? 'enabled' : 'disabled'}`);

      if (config.projects && config.projects.length > 0) {
        console.log(`\n${chalk.bold('Projects:')} ${config.projects.length}`);
        config.projects.forEach((project: any, index: number) => {
          console.log(`\n  ${index + 1}. ${chalk.cyan(project.name)}`);
          console.log(`     Working Dir: ${project.workingDirectory}`);
          if (project.maxLoopIterations) {
            console.log(`     Max Iterations: ${project.maxLoopIterations}`);
          }
        });
      }

      console.log(`\n${chalk.bold('Agents:')} ${config.agents.length}`);
      if (config.agents.length === 0) {
        console.log(chalk.yellow('  No agents configured'));
      } else {
        for (const agent of config.agents) {
          console.log(`\n  ${chalk.cyan(agent.name)} (${chalk.yellow(agent.type)})`);
          if (agent.model) console.log(`    Model: ${agent.model}`);
          if (agent.workingDirectory) console.log(`    Working Dir: ${agent.workingDirectory}`);
          if (agent.maxTokens) console.log(`    Max Tokens: ${agent.maxTokens}`);
          if (agent.timeout) console.log(`    Timeout: ${agent.timeout}ms`);
        }
      }
      console.log('');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      displayError(`Failed to load configuration: ${message}`);
      process.exit(1);
    }
  });

/**
 * Validate the configuration
 */
program
  .command('validate')
  .description('Validate configuration and check for issues')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--json', 'Output in JSON format')
  .action(async (opts) => {
    try {
      const configManager = new ConfigManager(opts.config);
      const configPath = configManager['configPath'];

      // Check if config file exists
      if (!existsSync(configPath)) {
        if (opts.json) {
          console.log(JSON.stringify({
            valid: false,
            errors: [`Configuration file not found at ${configPath}`]
          }, null, 2));
        } else {
          displayError(
            `Configuration file not found at ${configPath}`,
            `Run 'qwen-loop init' to create a configuration file`
          );
        }
        process.exit(1);
      }

      const config = configManager.getConfig();
      const errors = configManager.validateConfig();

      if (opts.json) {
        console.log(JSON.stringify({
          valid: errors.length === 0,
          errors: errors,
          summary: {
            totalIssues: errors.length,
            agentsConfigured: config.agents.length,
            projectsConfigured: config.projects?.length || 0,
            workingDirectory: config.workingDirectory
          }
        }, null, 2));
      } else {
        console.log(`\n${chalk.bold.cyan('🔍 Configuration Validation')}`);
        console.log(chalk.gray('═'.repeat(50)) + '\n');
        console.log(`  Config File: ${chalk.cyan(configPath)}`);
        console.log(`  Working Dir: ${config.workingDirectory}\n`);

        if (errors.length === 0) {
          console.log(chalk.green.bold('✓ Configuration is valid - No issues found\n'));
        } else {
          console.log(chalk.red.bold(`✖ Found ${errors.length} issue(s):\n`));
          errors.forEach((err, index) => {
            console.log(`  ${chalk.red(`${index + 1}.`)} ${err}`);
          });
          console.log(`\n${chalk.yellow('💡 Suggestions:')}`);
          
          // Provide specific suggestions based on errors
          if (errors.some(e => e.includes('No agents configured'))) {
            console.log(chalk.gray('  • Add at least one agent to the "agents" array in your config'));
            console.log(chalk.gray('  • Run "qwen-loop init" to create a fresh configuration'));
          }
          
          if (errors.some(e => e.includes('does not exist'))) {
            console.log(chalk.gray('  • Create the missing directories'));
            console.log(chalk.gray('  • Update the workingDirectory paths in your config'));
          }
          
          if (errors.some(e => e.includes('must be at least'))) {
            console.log(chalk.gray('  • Update the configuration values to meet minimum requirements'));
          }
          
          console.log('');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      if (opts.json) {
        console.log(JSON.stringify({
          valid: false,
          errors: [`Failed to validate configuration: ${message}`]
        }, null, 2));
      } else {
        displayError(`Failed to validate configuration: ${message}`);
      }
      process.exit(1);
    }
  });

// Export for programmatic use
export { LoopManager, MultiProjectManager, ConfigManager, QwenAgent, CustomAgent };

// Parse CLI arguments
program.parse(process.argv);
