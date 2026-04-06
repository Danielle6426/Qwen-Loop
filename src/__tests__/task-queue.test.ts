import test from 'node:test';
import { strict as assert } from 'node:assert';
import { TaskQueue } from '../core/task-queue.js';
import { TaskPriority, TaskStatus } from '../types.js';
import { createMockTask } from './test-utils.js';

test('TaskQueue - enqueue', async (t) => {
  await t.test('should add a task to the queue', () => {
    const queue = new TaskQueue();
    const task = createMockTask({ id: 'task-1' });

    queue.enqueue(task);

    assert.equal(queue.size(), 1);
    assert.equal(queue.isEmpty(), false);
  });

  await t.test('should set task status to PENDING', () => {
    const queue = new TaskQueue();
    const task = createMockTask({ id: 'task-1', status: TaskStatus.COMPLETED });

    queue.enqueue(task);

    assert.equal(task.status, TaskStatus.PENDING);
  });

  await t.test('should set createdAt timestamp', () => {
    const queue = new TaskQueue();
    const task = createMockTask({ id: 'task-1' });
    const beforeEnqueue = new Date();

    queue.enqueue(task);

    assert.ok(task.createdAt >= beforeEnqueue);
  });

  await t.test('should handle multiple tasks with different priorities', () => {
    const queue = new TaskQueue();
    const criticalTask = createMockTask({ id: 'critical', priority: TaskPriority.CRITICAL });
    const highTask = createMockTask({ id: 'high', priority: TaskPriority.HIGH });
    const mediumTask = createMockTask({ id: 'medium', priority: TaskPriority.MEDIUM });
    const lowTask = createMockTask({ id: 'low', priority: TaskPriority.LOW });

    queue.enqueue(lowTask);
    queue.enqueue(highTask);
    queue.enqueue(criticalTask);
    queue.enqueue(mediumTask);

    assert.equal(queue.size(), 4);
  });
});

test('TaskQueue - dequeue', async (t) => {
  await t.test('should return the highest priority task', () => {
    const queue = new TaskQueue();
    const lowTask = createMockTask({ id: 'low', priority: TaskPriority.LOW });
    const highTask = createMockTask({ id: 'high', priority: TaskPriority.HIGH });
    const mediumTask = createMockTask({ id: 'medium', priority: TaskPriority.MEDIUM });

    queue.enqueue(lowTask);
    queue.enqueue(highTask);
    queue.enqueue(mediumTask);

    const dequeued = queue.dequeue();

    assert.equal(dequeued?.id, 'high');
  });

  await t.test('should return null when queue is empty', () => {
    const queue = new TaskQueue();

    const result = queue.dequeue();

    assert.equal(result, null);
  });

  await t.test('should remove the task from the queue', () => {
    const queue = new TaskQueue();
    const task = createMockTask({ id: 'task-1' });

    queue.enqueue(task);
    queue.dequeue();

    assert.equal(queue.size(), 0);
  });

  await t.test('should respect priority order: CRITICAL > HIGH > MEDIUM > LOW', () => {
    const queue = new TaskQueue();
    const critical = createMockTask({ id: 'critical', priority: TaskPriority.CRITICAL });
    const high = createMockTask({ id: 'high', priority: TaskPriority.HIGH });
    const medium = createMockTask({ id: 'medium', priority: TaskPriority.MEDIUM });
    const low = createMockTask({ id: 'low', priority: TaskPriority.LOW });

    // Enqueue in reverse order
    queue.enqueue(low);
    queue.enqueue(medium);
    queue.enqueue(high);
    queue.enqueue(critical);

    const order: string[] = [];
    while (!queue.isEmpty()) {
      const task = queue.dequeue();
      if (task) order.push(task.id);
    }

    assert.deepEqual(order, ['critical', 'high', 'medium', 'low']);
  });

  await t.test('should return tasks in FIFO order within same priority', () => {
    const queue = new TaskQueue();
    const task1 = createMockTask({ id: 'first', priority: TaskPriority.HIGH });
    const task2 = createMockTask({ id: 'second', priority: TaskPriority.HIGH });

    queue.enqueue(task1);
    queue.enqueue(task2);

    const first = queue.dequeue();
    const second = queue.dequeue();

    assert.equal(first?.id, 'first');
    assert.equal(second?.id, 'second');
  });
});

test('TaskQueue - peek', async (t) => {
  await t.test('should return the highest priority task without removing it', () => {
    const queue = new TaskQueue();
    const highTask = createMockTask({ id: 'high', priority: TaskPriority.HIGH });
    const lowTask = createMockTask({ id: 'low', priority: TaskPriority.LOW });

    queue.enqueue(lowTask);
    queue.enqueue(highTask);

    const peeked = queue.peek();

    assert.equal(peeked?.id, 'high');
    assert.equal(queue.size(), 2);
  });

  await t.test('should return null when queue is empty', () => {
    const queue = new TaskQueue();

    const result = queue.peek();

    assert.equal(result, null);
  });
});

test('TaskQueue - isEmpty', async (t) => {
  await t.test('should return true for empty queue', () => {
    const queue = new TaskQueue();

    assert.equal(queue.isEmpty(), true);
  });

  await t.test('should return false when queue has tasks', () => {
    const queue = new TaskQueue();
    const task = createMockTask({ id: 'task-1' });

    queue.enqueue(task);

    assert.equal(queue.isEmpty(), false);
  });

  await t.test('should return true after all tasks are dequeued', () => {
    const queue = new TaskQueue();
    const task = createMockTask({ id: 'task-1' });

    queue.enqueue(task);
    queue.dequeue();

    assert.equal(queue.isEmpty(), true);
  });
});

test('TaskQueue - size', async (t) => {
  await t.test('should return 0 for empty queue', () => {
    const queue = new TaskQueue();

    assert.equal(queue.size(), 0);
  });

  await t.test('should return correct count after adding tasks', () => {
    const queue = new TaskQueue();

    queue.enqueue(createMockTask({ id: 'task-1' }));
    queue.enqueue(createMockTask({ id: 'task-2' }));
    queue.enqueue(createMockTask({ id: 'task-3' }));

    assert.equal(queue.size(), 3);
  });

  await t.test('should decrease after dequeue', () => {
    const queue = new TaskQueue();

    queue.enqueue(createMockTask({ id: 'task-1' }));
    queue.enqueue(createMockTask({ id: 'task-2' }));
    queue.dequeue();

    assert.equal(queue.size(), 1);
  });
});

test('TaskQueue - getTasksByStatus', async (t) => {
  await t.test('should filter tasks by status', () => {
    const queue = new TaskQueue();
    const task1 = createMockTask({ id: 'task-1' });
    const task2 = createMockTask({ id: 'task-2' });

    queue.enqueue(task1);
    queue.enqueue(task2);

    // After enqueue, tasks are PENDING
    const pendingTasks = queue.getTasksByStatus(TaskStatus.PENDING);
    assert.equal(pendingTasks.length, 2);

    // Update one task status
    queue.updateTaskStatus('task-1', TaskStatus.RUNNING);

    const runningTasks = queue.getTasksByStatus(TaskStatus.RUNNING);
    assert.equal(runningTasks.length, 1);
    assert.equal(runningTasks[0].id, 'task-1');
  });

  await t.test('should return empty array when no tasks match', () => {
    const queue = new TaskQueue();
    const task = createMockTask({ id: 'task-1' });

    queue.enqueue(task);

    const completedTasks = queue.getTasksByStatus(TaskStatus.COMPLETED);

    assert.equal(completedTasks.length, 0);
  });
});

test('TaskQueue - getAllTasks', async (t) => {
  await t.test('should return all tasks including completed ones', () => {
    const queue = new TaskQueue();
    const task1 = createMockTask({ id: 'task-1' });
    const task2 = createMockTask({ id: 'task-2' });

    queue.enqueue(task1);
    queue.enqueue(task2);

    const allTasks = queue.getAllTasks();

    assert.equal(allTasks.length, 2);
  });
});

test('TaskQueue - updateTaskStatus', async (t) => {
  await t.test('should update task status', () => {
    const queue = new TaskQueue();
    const task = createMockTask({ id: 'task-1' });

    queue.enqueue(task);
    queue.updateTaskStatus('task-1', TaskStatus.RUNNING);

    const updatedTask = queue.getTaskById('task-1');
    assert.equal(updatedTask?.status, TaskStatus.RUNNING);
  });

  await t.test('should throw error for non-existent task', () => {
    const queue = new TaskQueue();

    // Should throw with descriptive error message
    assert.throws(
      () => queue.updateTaskStatus('non-existent', TaskStatus.RUNNING),
      /TaskQueue\.updateTaskStatus: no task found/
    );
  });
});

test('TaskQueue - removeTask', async (t) => {
  await t.test('should remove task from queue', () => {
    const queue = new TaskQueue();
    const task = createMockTask({ id: 'task-1' });

    queue.enqueue(task);
    const removed = queue.removeTask('task-1');

    assert.equal(removed, true);
    assert.equal(queue.size(), 0);
  });

  await t.test('should return false for non-existent task', () => {
    const queue = new TaskQueue();

    const result = queue.removeTask('non-existent');

    assert.equal(result, false);
  });

  await t.test('should remove from priority queue as well', () => {
    const queue = new TaskQueue();
    const task = createMockTask({ id: 'task-1', priority: TaskPriority.HIGH });

    queue.enqueue(task);
    queue.removeTask('task-1');

    // Dequeue should return null since task was removed from priority queue
    const dequeued = queue.dequeue();
    assert.equal(dequeued, null);
  });
});
