import { ITaskQueue, Task, TaskStatus, TaskPriority } from '../types.js';
import { logger } from '../logger.js';

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

  enqueue(task: Task): void {
    task.status = TaskStatus.PENDING;
    task.createdAt = new Date();
    
    this.tasks.set(task.id, task);
    
    const queue = this.priorityQueues.get(task.priority);
    if (queue) {
      queue.push(task);
      logger.info(`Task ${task.id} enqueued with priority ${task.priority}`, { 
        task: task.id 
      });
    } else {
      logger.error(`Invalid priority ${task.priority} for task ${task.id}`, { 
        task: task.id 
      });
    }
  }

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
        logger.info(`Task ${task.id} dequeued with priority ${priority}`, { 
          task: task.id 
        });
        return task;
      }
    }

    return null;
  }

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

  isEmpty(): boolean {
    for (const queue of this.priorityQueues.values()) {
      if (queue.length > 0) {
        return false;
      }
    }
    return true;
  }

  size(): number {
    let total = 0;
    for (const queue of this.priorityQueues.values()) {
      total += queue.length;
    }
    return total;
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getTaskById(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      logger.debug(`Task ${taskId} status updated to ${status}`, { task: taskId });
    }
  }

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
