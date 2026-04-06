import { IAgent, AgentConfig, AgentStatus, AgentType, Task, AgentResult, TaskStatus } from '../types.js';
import { logger } from '../logger.js';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseAgent implements IAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly type: AgentType;
  public status: AgentStatus = AgentStatus.OFFLINE;
  
  protected config: AgentConfig;
  protected currentTask: Task | null = null;
  protected abortController: AbortController | null = null;

  constructor(config: AgentConfig) {
    this.id = uuidv4();
    this.name = config.name;
    this.type = config.type;
    this.config = config;
    logger.debug(`Agent created: ${this.name}`, { agent: this.name });
  }

  async initialize(): Promise<void> {
    try {
      this.status = AgentStatus.IDLE;
      await this.onInitialize();
      logger.info(`Agent initialized: ${this.name}`, { agent: this.name });
    } catch (error) {
      this.status = AgentStatus.ERROR;
      logger.error(`Agent initialization failed: ${this.name}`, { 
        agent: this.name,
        error
      });
      throw error;
    }
  }

  async executeTask(task: Task): Promise<AgentResult> {
    if (!this.isAvailable()) {
      throw new Error(`Agent ${this.name} is not available. Current status: ${this.status}`);
    }

    this.currentTask = task;
    this.status = AgentStatus.BUSY;
    this.abortController = new AbortController();

    const startTime = Date.now();
    task.status = TaskStatus.RUNNING;
    task.startedAt = new Date();
    task.assignedAgent = this.id;

    logger.debug(`Starting task: ${task.description.slice(0, 50)}...`, {
      agent: this.name,
      task: task.id
    });

    try {
      const result = await this.onExecuteTask(task, this.abortController.signal);

      const executionTime = Date.now() - startTime;
      result.executionTime = executionTime;

      if (result.success) {
        task.status = TaskStatus.COMPLETED;
        task.completedAt = new Date();
        task.result = result.output;
      } else {
        task.status = TaskStatus.FAILED;
        task.completedAt = new Date();
        task.error = result.error;
        logger.warn(`Task failed: ${result.error?.slice(0, 80)}`, {
          agent: this.name,
          task: task.id
        });
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      task.status = TaskStatus.FAILED;
      task.completedAt = new Date();
      task.error = errorMessage;

      logger.error(`Task execution error: ${errorMessage}`, {
        agent: this.name,
        task: task.id
      });

      return {
        success: false,
        error: errorMessage,
        executionTime
      };
    } finally {
      this.status = AgentStatus.IDLE;
      this.currentTask = null;
      this.abortController = null;
    }
  }

  async cancelTask(): Promise<void> {
    if (this.currentTask && this.abortController) {
      logger.debug(`Cancelling task`, {
        agent: this.name,
        task: this.currentTask.id
      });

      this.abortController.abort();

      if (this.currentTask) {
        this.currentTask.status = TaskStatus.CANCELLED;
        this.currentTask = null;
      }

      this.status = AgentStatus.IDLE;
    }
  }

  /**
   * Get the current status of the agent
   * @returns The agent's current status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Check if the agent is available to accept new tasks
   * @returns True if the agent is idle and can accept tasks
   */
  isAvailable(): boolean {
    return this.status === AgentStatus.IDLE;
  }

  /**
   * Initialize the agent (to be implemented by subclasses)
   * @throws Error if initialization fails
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * Execute a task (to be implemented by subclasses)
   * @param task - The task to execute
   * @param signal - Abort signal for cancellation
   * @returns Promise resolving to the execution result
   */
  protected abstract onExecuteTask(task: Task, signal: AbortSignal): Promise<AgentResult>;
}
