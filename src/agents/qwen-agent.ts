import { BaseAgent } from './base-agent.js';
import { AgentConfig, Task, AgentResult, AgentType } from '../types.js';
import { logger } from '../logger.js';
import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Agent implementation that uses Qwen Code CLI to execute tasks.
 * Spawns the `qwen` CLI process with task descriptions as prompts.
 */
export class QwenAgent extends BaseAgent {
  private qwenPath: string;
  private workingDir: string;

  /**
   * Create a new QwenAgent
   * @param config - Agent configuration including optional model, timeout, and working directory
   */
  constructor(config: AgentConfig) {
    super({
      ...config,
      type: AgentType.QWEN
    });

    // On Windows, use .cmd extension
    const isWindows = process.platform === 'win32';
    this.qwenPath = process.env.QWEN_PATH || (isWindows ? 'qwen.cmd' : 'qwen');
    this.workingDir = config.workingDirectory || process.cwd();

    if (!existsSync(this.workingDir)) {
      mkdirSync(this.workingDir, { recursive: true });
    }
  }

  protected async onInitialize(): Promise<void> {
    logger.debug('Verifying Qwen Code CLI availability', { agent: this.name });

    return new Promise((resolve, reject) => {
      const checkProcess = spawn(this.qwenPath, ['--version'], {
        windowsHide: true,
        shell: true
      });

      checkProcess.on('close', (code: number | null) => {
        logger.debug(`Qwen Code CLI check complete (exit: ${code})`, { agent: this.name });
        resolve();
      });

      checkProcess.on('error', (error: Error) => {
        logger.error(`Qwen Code CLI not found`, { agent: this.name, error });
        reject(new Error(`Qwen Code CLI is not installed or not in PATH. Install it first.`));
      });
    });
  }

  protected async onExecuteTask(task: Task, signal: AbortSignal): Promise<AgentResult> {
    const startTime = Date.now();

    logger.info(`Executing task: ${task.description.slice(0, 60)}${task.description.length > 60 ? '...' : ''}`, {
      agent: this.name,
      task: task.id
    });

    // Build the command based on task description
    const args = this.buildCommandArgs(task);

    return new Promise((resolve) => {
      const qwenProcess = spawn(this.qwenPath, args, {
        cwd: this.workingDir,
        windowsHide: true,
        shell: true
      });

      let output = '';
      let errorOutput = '';
      const filesModified: string[] = [];
      const filesCreated: string[] = [];

      qwenProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        // Only log debug output for first 200 chars to avoid verbosity
        if (text.length < 200) {
          logger.debug(`Agent output: ${text}`, { agent: this.name, task: task.id });
        }

        // Try to detect file operations from output
        this.parseFileOperations(text, filesModified, filesCreated);
      });

      qwenProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        // Only log stderr if it's significant (not just warnings)
        if (!text.includes('Warning') && !text.includes('warning')) {
          logger.debug(`Agent stderr: ${text.slice(0, 100)}`, { agent: this.name, task: task.id });
        }
      });

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          logger.info('Task aborted', { agent: this.name, task: task.id });
          qwenProcess.kill();
          resolve({
            success: false,
            error: 'Task was cancelled',
            executionTime: Date.now() - startTime
          });
        }, { once: true });
      }

      qwenProcess.on('close', (code) => {
        const success = code === 0;

        resolve({
          success,
          output: output || undefined,
          error: success ? undefined : (errorOutput || `Process exited with code ${code}`),
          executionTime: Date.now() - startTime,
          filesModified: filesModified.length > 0 ? filesModified : undefined,
          filesCreated: filesCreated.length > 0 ? filesCreated : undefined
        });
      });

      qwenProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to start agent process: ${error.message}`,
          executionTime: Date.now() - startTime
        });
      });
    });
  }

  private buildCommandArgs(task: Task): string[] {
    const args: string[] = [];

    // Use positional prompt (Qwen CLI default behavior)
    // Format: qwen "prompt" -o text
    args.push(task.description);

    // Use --yolo shorthand flag (official, shorter, well-tested)
    args.push('--yolo');

    // Add model if specified
    if (this.config.model) {
      args.push('-m', this.config.model);
    }

    // Add output format
    args.push('-o', 'text');

    // Add custom args from config
    if (this.config.additionalArgs) {
      args.push(...this.config.additionalArgs);
    }

    return args;
  }

  private parseFileOperations(
    output: string, 
    filesModified: string[], 
    filesCreated: string[]
  ): void {
    // Simple regex patterns to detect file operations
    const modifiedPattern = /(?:modified|updated|changed)\s+([^\s]+\.\w+)/gi;
    const createdPattern = /(?:created|written|new file)\s+([^\s]+\.\w+)/gi;

    let match;
    while ((match = modifiedPattern.exec(output)) !== null) {
      const file = match[1];
      if (!filesModified.includes(file)) {
        filesModified.push(file);
      }
    }

    while ((match = createdPattern.exec(output)) !== null) {
      const file = match[1];
      if (!filesCreated.includes(file)) {
        filesCreated.push(file);
      }
    }
  }
}
