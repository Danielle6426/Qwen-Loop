import { ITaskQueue, Task, TaskStatus, TaskPriority } from '../types.js';
import { logger } from '../logger.js';

/**
 * Priority-based task queue implementation.
 * Maintains separate queues for each priority level and processes
 * tasks in priority order (CRITICAL > HIGH > MEDIUM > LOW).
 */
export class TaskQueue implements ITaskQueue {
  private tasks: Map<string, Task> = new Map();
  private priorityQueues: Map<TaskPriority, Task[]> = new Map();

  constructor() {
    // Initialize priority queues
    this.priorityQueues.set(TaskPriority.CRITICAL, []);
    this.priorityQueues.set(TaskPriority.HIGH, []);
    this.priorityQueues.set(TaskPriority.MEDIUM, []);
    this.priorityQueues.set(TaskPriority.LOW, []);
  }

  /**
   * Add a task to the queue with the specified priority
   * @param task - The task to enqueue
   */
  enqueue(task: Task): void {
    task.status = TaskStatus.PENDING;
    task.createdAt = new Date();

    this.tasks.set(task.id, task);

    const queue = this.priorityQueues.get(task.priority);
    if (queue) {
      queue.push(task);
      logger.debug(`Task enqueued: ${task.priority}`, { task: task.id });
    } else {
      logger.error(`Invalid priority: ${task.priority}`, { task: task.id });
    }
  }

  /**
   * Remove and return the highest priority task from the queue
   * @returns The dequeued task, or null if queue is empty
   */
  dequeue(): Task | null {
    // Process tasks in priority order: CRITICAL > HIGH > MEDIUM > LOW
    const priorityOrder = [
      TaskPriority.CRITICAL,
      TaskPriority.HIGH,
      TaskPriority.MEDIUM,
      TaskPriority.LOW
    ];

    for (const priority of priorityOrder) {
      const queue = this.priorityQueues.get(priority);
      if (queue && queue.length > 0) {
        const task = queue.shift()!;
        logger.debug(`Task dequeued: ${task.priority}`, { task: task.id });
        return task;
      }
    }

    return null;
  }

  /**
   * View the highest priority task without removing it
   * @returns The next task to be dequeued, or null if queue is empty
   */
  peek(): Task | null {
    const priorityOrder = [
      TaskPriority.CRITICAL,
      TaskPriority.HIGH,
      TaskPriority.MEDIUM,
      TaskPriority.LOW
    ];

    for (const priority of priorityOrder) {
      const queue = this.priorityQueues.get(priority);
      if (queue && queue.length > 0) {
        return queue[0];
      }
    }

    return null;
  }

  /**
   * Check if the queue is empty
   * @returns True if queue has no tasks, false otherwise
   */
  isEmpty(): boolean {
    for (const queue of this.priorityQueues.values()) {
      if (queue.length > 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get the total number of tasks in the queue
   * @returns Number of pending tasks across all priority levels
   */
  size(): number {
    let total = 0;
    for (const queue of this.priorityQueues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Get all tasks with a specific status
   * @param status - The status to filter by
   * @returns Array of tasks matching the specified status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * Get all tasks in the queue
   * @returns Array of all tasks regardless of status
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get a task by its ID
   * @param taskId - The unique identifier of the task
   * @returns The task if found, undefined otherwise
   */
  getTaskById(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Update the status of a task
   * @param taskId - The unique identifier of the task
   * @param status - The new status to set
   */
  updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      logger.debug(`Task ${taskId} status updated to ${status}`, { task: taskId });
    }
  }

  /**
   * Remove a task from the queue
   * @param taskId - The unique identifier of the task to remove
   * @returns True if the task was found and removed, false otherwise
   */
  removeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      this.tasks.delete(taskId);
      
      // Remove from priority queue
      for (const queue of this.priorityQueues.values()) {
        const index = queue.findIndex(t => t.id === taskId);
        if (index !== -1) {
          queue.splice(index, 1);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get a formatted string with queue statistics
   * @returns A human-readable statistics report
   */
  getQueueStats(): string {
    let stats = '\n=== Task Queue Stats ===\n';
    stats += `Total Tasks: ${this.tasks.size}\n`;
    stats += `Pending in Queue: ${this.size()}\n\n`;
    
    stats += 'By Priority:\n';
    for (const [priority, queue] of this.priorityQueues.entries()) {
      stats += `  ${priority}: ${queue.length}\n`;
    }
    
    const pendingTasks = this.getTasksByStatus(TaskStatus.PENDING);
    const runningTasks = this.getTasksByStatus(TaskStatus.RUNNING);
    const completedTasks = this.getTasksByStatus(TaskStatus.COMPLETED);
    const failedTasks = this.getTasksByStatus(TaskStatus.FAILED);
    
    stats += '\nBy Status:\n';
    stats += `  PENDING: ${pendingTasks.length}\n`;
    stats += `  RUNNING: ${runningTasks.length}\n`;
    stats += `  COMPLETED: ${completedTasks.length}\n`;
    stats += `  FAILED: ${failedTasks.length}\n`;
    
    return stats;
  }
}
