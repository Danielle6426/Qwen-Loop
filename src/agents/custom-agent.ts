import { BaseAgent } from './base-agent.js';
import { AgentConfig, Task, AgentResult, AgentType } from '../types.js';
import { logger } from '../logger.js';
import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

export class CustomAgent extends BaseAgent {
  private command: string;
  private workingDir: string;

  constructor(config: AgentConfig) {
    super({
      ...config,
      type: AgentType.CUSTOM
    });
    
    // For custom agents, the config.name should be the command to execute
    this.command = config.name;
    this.workingDir = config.workingDirectory || process.cwd();
    
    if (!existsSync(this.workingDir)) {
      mkdirSync(this.workingDir, { recursive: true });
    }
  }

  protected async onInitialize(): Promise<void> {
    logger.info(`Checking custom agent command: ${this.command}`, { agent: this.name });
    
    return new Promise((resolve) => {
      const checkProcess = spawn(this.command, ['--help'], {
        timeout: 10000,
        windowsHide: true
      });

      let output = '';
      let errorOutput = '';

      checkProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      checkProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      checkProcess.on('close', (code) => {
        logger.info(`Custom agent ${this.name} initialized (help exit code: ${code})`, { 
          agent: this.name 
        });
        resolve();
      });

      checkProcess.on('error', (error) => {
        logger.warn(`Custom agent help check failed: ${error.message}`, { agent: this.name });
        // Still resolve to allow execution
        resolve();
      });
    });
  }

  protected async onExecuteTask(task: Task, signal: AbortSignal): Promise<AgentResult> {
    const startTime = Date.now();
    
    logger.info(`Executing custom task: ${task.description}`, { 
      agent: this.name, 
      task: task.id 
    });

    // Build the command
    const args = this.buildCommandArgs(task);
    
    return new Promise((resolve) => {
      const childProcess = spawn(this.command, args, {
        cwd: this.workingDir,
        windowsHide: true,
        shell: true
      });

      let output = '';
      let errorOutput = '';
      const filesModified: string[] = [];
      const filesCreated: string[] = [];

      childProcess.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        logger.debug(`${this.name} output: ${text}`, { agent: this.name, task: task.id });
        this.parseFileOperations(text, filesModified, filesCreated);
      });

      childProcess.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        errorOutput += text;
        logger.warn(`${this.name} stderr: ${text}`, { agent: this.name, task: task.id });
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          logger.info('Task aborted by controller', { agent: this.name, task: task.id });
          childProcess.kill();
          resolve({
            success: false,
            error: 'Task was cancelled',
            executionTime: Date.now() - startTime
          });
        }, { once: true });
      }

      childProcess.on('close', (code: number | null) => {
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

      childProcess.on('error', (error: Error) => {
        resolve({
          success: false,
          error: `Failed to start process: ${error.message}`,
          executionTime: Date.now() - startTime
        });
      });
    });
  }

  private buildCommandArgs(task: Task): string[] {
    const args: string[] = [];
    
    if (this.config.additionalArgs) {
      args.push(...this.config.additionalArgs);
    }

    args.push(task.description);

    if (this.config.model) {
      args.push('--model', this.config.model);
    }

    if (this.config.maxTokens) {
      args.push('--max-tokens', this.config.maxTokens.toString());
    }

    return args;
  }

  private parseFileOperations(
    output: string, 
    filesModified: string[], 
    filesCreated: string[]
  ): void {
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
