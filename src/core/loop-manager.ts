import { ILoopManager, LoopStats, LoopConfig, Task, TaskStatus, TaskPriority, AgentResult } from '../types.js';
import { AgentOrchestrator } from './orchestrator.js';
import { TaskQueue } from './task-queue.js';
import { logger } from '../logger.js';
import { v4 as uuidv4 } from 'uuid';

export class LoopManager implements ILoopManager {
  private orchestrator: AgentOrchestrator;
  private taskQueue: TaskQueue;
  private config: LoopConfig;
  
  private isLoopRunning = false;
  private isLoopPaused = false;
  private loopInterval: NodeJS.Timeout | null = null;
  private startTime: Date | null = null;
  private completedTasksCount = 0;
  private failedTasksCount = 0;
  private totalExecutionTime = 0;

  constructor(config: LoopConfig) {
    this.config = config;
    this.orchestrator = new AgentOrchestrator();
    this.taskQueue = new TaskQueue();
  }

  async start(): Promise<void> {
    if (this.isLoopRunning) {
      logger.warn('Loop is already running');
      return;
    }

    logger.info('Starting Qwen Loop...');
    
    // Initialize all agents
    await this.orchestrator.initializeAll();
    
    this.isLoopRunning = true;
    this.isLoopPaused = false;
    this.startTime = new Date();
    
    logger.info(`Loop started with interval ${this.config.loopInterval}ms`);
    
    // Start the loop
    this.runLoop();
  }

  async stop(): Promise<void> {
    if (!this.isLoopRunning) {
      return;
    }

    logger.info('Stopping Qwen Loop...');
    
    this.isLoopRunning = false;
    this.isLoopPaused = false;
    
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }

    // Cancel all running tasks
    await this.orchestrator.cancelAllTasks();
    
    logger.info('Loop stopped');
  }

  async pause(): Promise<void> {
    if (!this.isLoopRunning) {
      return;
    }

    logger.info('Pausing Qwen Loop...');
    this.isLoopPaused = true;
    
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    
    logger.info('Loop paused');
  }

  async resume(): Promise<void> {
    if (!this.isLoopRunning || !this.isLoopPaused) {
      return;
    }

    logger.info('Resuming Qwen Loop...');
    this.isLoopPaused = false;
    this.runLoop();
  }

  isRunning(): boolean {
    return this.isLoopRunning && !this.isLoopPaused;
  }

  getStats(): LoopStats {
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    const averageExecutionTime = this.completedTasksCount > 0 
      ? this.totalExecutionTime / this.completedTasksCount 
      : 0;

    return {
      totalTasks: this.taskQueue.getAllTasks().length,
      completedTasks: this.completedTasksCount,
      failedTasks: this.failedTasksCount,
      runningTasks: this.taskQueue.getTasksByStatus(TaskStatus.RUNNING).length,
      activeAgents: this.orchestrator.getAvailableAgents().length,
      uptime,
      averageExecutionTime
    };
  }

  addTask(description: string, priority: TaskPriority = TaskPriority.MEDIUM, metadata?: Record<string, any>): Task {
    const task: Task = {
      id: uuidv4(),
      description,
      priority,
      status: TaskStatus.PENDING,
      createdAt: new Date(),
      metadata
    };

    this.taskQueue.enqueue(task);
    logger.info(`Task added to queue: ${task.id} - ${description}`);
    
    return task;
  }

  getTaskQueue(): TaskQueue {
    return this.taskQueue;
  }

  getOrchestrator(): AgentOrchestrator {
    return this.orchestrator;
  }

  getConfig(): LoopConfig {
    return this.config;
  }

  private async runLoop(): Promise<void> {
    this.loopInterval = setInterval(async () => {
      if (this.isLoopPaused || !this.isLoopRunning) {
        return;
      }

      try {
        await this.processLoopIteration();
      } catch (error) {
        logger.error(`Error in loop iteration: ${error}`);
      }
    }, this.config.loopInterval);

    // Run immediately first
    try {
      await this.processLoopIteration();
    } catch (error) {
      logger.error(`Error in initial loop iteration: ${error}`);
    }
  }

  private async processLoopIteration(): Promise<void> {
    // Check if we've reached max concurrent tasks
    const runningTasks = this.taskQueue.getTasksByStatus(TaskStatus.RUNNING);
    if (runningTasks.length >= this.config.maxConcurrentTasks) {
      logger.debug(`Max concurrent tasks reached (${this.config.maxConcurrentTasks}), waiting...`);
      return;
    }

    // Dequeue next task
    const task = this.taskQueue.dequeue();
    if (!task) {
      logger.debug('No tasks in queue');
      return;
    }

    // Assign task to an available agent
    const agent = await this.orchestrator.assignTask(task);
    if (!agent) {
      // No available agents, re-enqueue the task
      this.taskQueue.enqueue(task);
      return;
    }

    // Execute the task
    task.status = TaskStatus.RUNNING;
    
    try {
      const result = await agent.executeTask(task);
      
      if (result.success) {
        this.completedTasksCount++;
        this.totalExecutionTime += result.executionTime;
        logger.info(`Task ${task.id} completed successfully in ${result.executionTime}ms`, { 
          task: task.id 
        });
      } else {
        this.failedTasksCount++;
        this.totalExecutionTime += result.executionTime;
        
        // Retry logic
        const retryCount = task.metadata?.retryCount || 0;
        if (retryCount < this.config.maxRetries) {
          task.metadata = task.metadata || {};
          task.metadata.retryCount = retryCount + 1;
          task.status = TaskStatus.PENDING;
          this.taskQueue.enqueue(task);
          logger.warn(`Task ${task.id} failed, retrying (${retryCount + 1}/${this.config.maxRetries})`, { 
            task: task.id 
          });
        } else {
          logger.error(`Task ${task.id} failed after ${retryCount} retries: ${result.error}`, { 
            task: task.id 
          });
        }
      }
    } catch (error) {
      this.failedTasksCount++;
      logger.error(`Unexpected error executing task ${task.id}: ${error}`, { 
        task: task.id 
      });
    }
  }

  getAgentStatusReport(): string {
    return this.orchestrator.getAgentStatusReport();
  }

  getTaskQueueStats(): string {
    return this.taskQueue.getQueueStats();
  }
}
