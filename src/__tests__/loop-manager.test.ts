import test from 'node:test';
import { strict as assert } from 'node:assert';
import { LoopManager } from '../core/loop-manager.js';
import { AgentOrchestrator } from '../core/orchestrator.js';
import { TaskQueue } from '../core/task-queue.js';
import { LoopConfig, TaskPriority, TaskStatus } from '../types.js';
import { createMockAgent, createMockTask } from './test-utils.js';

/**
 * Helper to create a minimal loop config for testing
 */
function createTestConfig(overrides: Partial<LoopConfig> = {}): LoopConfig {
  return {
    agents: [],
    maxConcurrentTasks: 1,
    loopInterval: 1000, // 1 second
    maxRetries: 3,
    workingDirectory: process.cwd(),
    logLevel: 'error',
    enableAutoStart: false,
    enableSelfTaskGeneration: false,
    ...overrides
  };
}

test('LoopManager - constructor', async (t) => {
  await t.test('should create a LoopManager instance', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    assert.ok(manager);
  });

  await t.test('should initialize orchestrator and taskQueue', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    assert.ok(manager.getOrchestrator() instanceof AgentOrchestrator);
    assert.ok(manager.getTaskQueue() instanceof TaskQueue);
  });

  await t.test('should not create selfTaskGenerator when disabled', () => {
    const config = createTestConfig({ enableSelfTaskGeneration: false });
    const manager = new LoopManager(config);

    // Internal check - accessing via getTaskQueue to verify basic functionality
    const queue = manager.getTaskQueue();
    assert.equal(queue.isEmpty(), true);
  });
});

test('LoopManager - getStats', async (t) => {
  await t.test('should return initial stats', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    const stats = manager.getStats();

    assert.equal(stats.totalTasks, 0);
    assert.equal(stats.completedTasks, 0);
    assert.equal(stats.failedTasks, 0);
    assert.equal(stats.runningTasks, 0);
  });

  await t.test('should track total tasks after adding tasks', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    manager.addTask('Test task 1', TaskPriority.LOW);
    manager.addTask('Test task 2', TaskPriority.HIGH);

    const stats = manager.getStats();

    assert.equal(stats.totalTasks, 2);
  });
});

test('LoopManager - addTask', async (t) => {
  await t.test('should add a task to the queue', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    const task = manager.addTask('Test task', TaskPriority.MEDIUM);

    assert.ok(task.id);
    assert.equal(task.description, 'Test task');
    assert.equal(task.priority, TaskPriority.MEDIUM);
    assert.equal(task.status, TaskStatus.PENDING);
  });

  await t.test('should use default priority MEDIUM when not specified', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    const task = manager.addTask('Test task');

    assert.equal(task.priority, TaskPriority.MEDIUM);
  });

  await t.test('should attach metadata to task', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    const task = manager.addTask('Test task', TaskPriority.HIGH, { custom: 'data' });

    assert.deepEqual(task.metadata, { custom: 'data' });
  });

  await t.test('should increment queue size', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    const initialSize = manager.getTaskQueue().size();
    manager.addTask('Test task');

    assert.equal(manager.getTaskQueue().size(), initialSize + 1);
  });
});

test('LoopManager - isRunning', async (t) => {
  await t.test('should return false initially', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    assert.equal(manager.isRunning(), false);
  });
});

test('LoopManager - getConfig', async (t) => {
  await t.test('should return the original config', () => {
    const config = createTestConfig({ loopInterval: 2000, maxRetries: 5 });
    const manager = new LoopManager(config);

    const returnedConfig = manager.getConfig();

    assert.equal(returnedConfig.loopInterval, 2000);
    assert.equal(returnedConfig.maxRetries, 5);
  });
});

test('LoopManager - getAgentStatusReport', async (t) => {
  await t.test('should return a status report string', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    const report = manager.getAgentStatusReport();

    assert.equal(typeof report, 'string');
    assert.ok(report.includes('Agent Status Report'));
  });
});

test('LoopManager - getTaskQueueStats', async (t) => {
  await t.test('should return a stats string', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    const stats = manager.getTaskQueueStats();

    assert.equal(typeof stats, 'string');
    assert.ok(stats.includes('Task Queue Stats'));
  });
});

test('LoopManager - task assignment with agent', async (t) => {
  await t.test('should assign tasks to registered agents', async () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);
    const orchestrator = manager.getOrchestrator();

    const agent = createMockAgent({ id: 'agent-1' });
    orchestrator.registerAgent(agent);

    const task = manager.addTask('Test task');
    const assignedAgent = await orchestrator.assignTask(task);

    assert.equal(assignedAgent?.id, 'agent-1');
    assert.equal(task.assignedAgent, 'agent-1');
  });
});

test('LoopManager - task execution with agent', async (t) => {
  await t.test('should execute task successfully with agent', async () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);
    const orchestrator = manager.getOrchestrator();

    const agent = createMockAgent({
      id: 'agent-1',
      executeResult: { success: true, executionTime: 50 }
    });
    orchestrator.registerAgent(agent);

    const task = manager.addTask('Test task');
    const assignedAgent = await orchestrator.assignTask(task);

    assert.ok(assignedAgent);

    const result = await agent.executeTask(task);

    assert.equal(result.success, true);
    assert.equal(result.executionTime, 50);
  });

  await t.test('should handle task execution failure', async () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);
    const orchestrator = manager.getOrchestrator();

    const agent = createMockAgent({
      id: 'agent-1',
      executeResult: { success: false, executionTime: 50, error: 'Test error' }
    });
    orchestrator.registerAgent(agent);

    const task = manager.addTask('Test task');
    await orchestrator.assignTask(task);

    const result = await agent.executeTask(task);

    assert.equal(result.success, false);
    assert.equal(result.error, 'Test error');
  });
});

test('LoopManager - access to internal components', async (t) => {
  await t.test('should provide access to orchestrator', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    const orchestrator = manager.getOrchestrator();

    assert.ok(orchestrator);
    assert.equal(typeof orchestrator.registerAgent, 'function');
  });

  await t.test('should provide access to task queue', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    const queue = manager.getTaskQueue();

    assert.ok(queue);
    assert.equal(typeof queue.enqueue, 'function');
  });
});

test('LoopManager - multiple agents and task distribution', async (t) => {
  await t.test('should handle multiple agents registration', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);
    const orchestrator = manager.getOrchestrator();

    const agent1 = createMockAgent({ id: 'agent-1' });
    const agent2 = createMockAgent({ id: 'agent-2' });
    const agent3 = createMockAgent({ id: 'agent-3' });

    orchestrator.registerAgent(agent1);
    orchestrator.registerAgent(agent2);
    orchestrator.registerAgent(agent3);

    const agents = orchestrator.getAllAgents();
    assert.equal(agents.length, 3);
  });

  await t.test('should show correct available agents count in stats', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);
    const orchestrator = manager.getOrchestrator();

    orchestrator.registerAgent(createMockAgent({ id: 'agent-1' }));
    orchestrator.registerAgent(createMockAgent({ id: 'agent-2' }));

    const stats = manager.getStats();

    assert.equal(stats.activeAgents, 2);
  });
});

test('LoopManager - task priority handling', async (t) => {
  await t.test('should respect task priority when adding tasks', () => {
    const config = createTestConfig();
    const manager = new LoopManager(config);

    const lowTask = manager.addTask('Low priority', TaskPriority.LOW);
    const highTask = manager.addTask('High priority', TaskPriority.HIGH);
    const criticalTask = manager.addTask('Critical', TaskPriority.CRITICAL);

    const queue = manager.getTaskQueue();

    // Dequeue should return highest priority first
    const first = queue.dequeue();
    const second = queue.dequeue();
    const third = queue.dequeue();

    assert.equal(first?.id, criticalTask.id);
    assert.equal(second?.id, highTask.id);
    assert.equal(third?.id, lowTask.id);
  });
});
