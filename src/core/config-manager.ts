import { LoopConfig, AgentConfig, AgentType } from '../types.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../logger.js';

const DEFAULT_CONFIG: Partial<LoopConfig> = {
  maxConcurrentTasks: 3,
  loopInterval: 5000, // 5 seconds
  maxRetries: 3,
  workingDirectory: process.cwd(),
  logLevel: 'info',
  enableAutoStart: false,
  maxLoopIterations: 0, // 0 = unlimited
  enableSelfTaskGeneration: true
};

export class ConfigManager {
  private configPath: string;
  private config: LoopConfig;

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), 'qwen-loop.config.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): LoopConfig {
    if (existsSync(this.configPath)) {
      try {
        const configData = readFileSync(this.configPath, 'utf-8');
        const config = JSON.parse(configData);
        
        logger.info(`Configuration loaded from ${this.configPath}`);
        
        return {
          ...DEFAULT_CONFIG,
          ...config,
          agents: config.agents || []
        } as LoopConfig;
      } catch (error) {
        logger.error(`Failed to load configuration: ${error}`);
        return this.getDefaultConfig();
      }
    } else {
      logger.info('No configuration file found, using defaults');
      return this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): LoopConfig {
    return {
      ...DEFAULT_CONFIG,
      agents: [],
      maxConcurrentTasks: DEFAULT_CONFIG.maxConcurrentTasks!,
      loopInterval: DEFAULT_CONFIG.loopInterval!,
      maxRetries: DEFAULT_CONFIG.maxRetries!,
      workingDirectory: DEFAULT_CONFIG.workingDirectory!,
      logLevel: DEFAULT_CONFIG.logLevel!,
      enableAutoStart: DEFAULT_CONFIG.enableAutoStart!
    };
  }

  saveConfig(): void {
    try {
      const configDir = join(this.configPath, '..');
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      logger.info(`Configuration saved to ${this.configPath}`);
    } catch (error) {
      logger.error(`Failed to save configuration: ${error}`);
      throw error;
    }
  }

  getConfig(): LoopConfig {
    return this.config;
  }

  updateConfig(updates: Partial<LoopConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };
    this.saveConfig();
  }

  addAgent(agentConfig: AgentConfig): void {
    this.config.agents.push(agentConfig);
    this.saveConfig();
    logger.info(`Agent ${agentConfig.name} added to configuration`);
  }

  removeAgent(agentName: string): void {
    const index = this.config.agents.findIndex(a => a.name === agentName);
    if (index !== -1) {
      this.config.agents.splice(index, 1);
      this.saveConfig();
      logger.info(`Agent ${agentName} removed from configuration`);
    }
  }

  getAgents(): AgentConfig[] {
    return this.config.agents;
  }

  generateExampleConfig(): string {
    const exampleConfig: LoopConfig = {
      agents: [
        {
          name: 'qwen-dev',
          type: AgentType.QWEN,
          maxTokens: 8192,
          timeout: 300000,
          workingDirectory: './project'
        }
      ],
      maxConcurrentTasks: 1,
      loopInterval: 5000,
      maxRetries: 2,
      workingDirectory: './project',
      logLevel: 'info',
      enableAutoStart: false,
      maxLoopIterations: 5,
      enableSelfTaskGeneration: true
    };

    return JSON.stringify(exampleConfig, null, 2);
  }

  validateConfig(): string[] {
    const errors: string[] = [];

    if (!this.config.agents || this.config.agents.length === 0) {
      errors.push('No agents configured');
    }

    if (this.config.maxConcurrentTasks < 1) {
      errors.push('maxConcurrentTasks must be at least 1');
    }

    if (this.config.loopInterval < 1000) {
      errors.push('loopInterval must be at least 1000ms (1 second)');
    }

    if (this.config.maxRetries < 0) {
      errors.push('maxRetries must be non-negative');
    }

    // Validate agents
    for (const agent of this.config.agents) {
      if (!agent.name) {
        errors.push('Agent must have a name');
      }
      if (!agent.type) {
        errors.push(`Agent ${agent.name} must have a type`);
      }
    }

    return errors;
  }
}
