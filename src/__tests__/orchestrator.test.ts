import test from 'node:test';
import { strict as assert } from 'node:assert';
import { AgentOrchestrator } from '../core/orchestrator.js';
import { AgentStatus, AgentType, TaskStatus, TaskPriority } from '../types.js';
import { createMockAgent, createMockTask } from './test-utils.js';

test('AgentOrchestrator - registerAgent', async (t) => {
  await t.test('should register an agent', () => {
    const orchestrator = new AgentOrchestrator();
    const agent = createMockAgent({ id: 'agent-1', name: 'TestAgent' });

    orchestrator.registerAgent(agent);

    const retrieved = orchestrator.getAgentById('agent-1');
    assert.equal(retrieved?.name, 'TestAgent');
  });

  await t.test('should make agent available in getAllAgents', () => {
    const orchestrator = new AgentOrchestrator();
    const agent1 = createMockAgent({ id: 'agent-1' });
    const agent2 = createMockAgent({ id: 'agent-2' });

    orchestrator.registerAgent(agent1);
    orchestrator.registerAgent(agent2);

    const agents = orchestrator.getAllAgents();

    assert.equal(agents.length, 2);
  });

  await t.test('should include agent in available agents if idle', () => {
    const orchestrator = new AgentOrchestrator();
    const agent = createMockAgent({ id: 'agent-1' });

    orchestrator.registerAgent(agent);

    const available = orchestrator.getAvailableAgents();

    assert.equal(available.length, 1);
    assert.equal(available[0].id, 'agent-1');
  });
});

test('AgentOrchestrator - removeAgent', async (t) => {
  await t.test('should remove an agent from the orchestrator', () => {
    const orchestrator = new AgentOrchestrator();
    const agent = createMockAgent({ id: 'agent-1' });

    orchestrator.registerAgent(agent);
    orchestrator.removeAgent('agent-1');

    const retrieved = orchestrator.getAgentById('agent-1');
    assert.equal(retrieved, undefined);
  });

  await t.test('should call cancelTask on the agent being removed', async () => {
    const orchestrator = new AgentOrchestrator();
    const agent = createMockAgent({ id: 'agent-1' });

    orchestrator.registerAgent(agent);
    await orchestrator.removeAgent('agent-1');

    assert.equal(agent.wasCancelCalled(), true);
  });

  await t.test('should remove task assignments for the removed agent', () => {
    const orchestrator = new AgentOrchestrator();
    const agent = createMockAgent({ id: 'agent-1' });
    const task = createMockTask({ id: 'task-1' });

    orchestrator.registerAgent(agent);
    // Simulate task assignment
    orchestrator.assignTask(task);

    orchestrator.removeAgent('agent-1');

    const assignment = orchestrator.getTaskAssignment('task-1');
    assert.equal(assignment, undefined);
  });

  await t.test('should not throw when removing non-existent agent', () => {
    const orchestrator = new AgentOrchestrator();

    // Should not throw
    orchestrator.removeAgent('non-existent');
  });
});

test('AgentOrchestrator - assignTask', async (t) => {
  await t.test('should assign task to an available agent', async () => {
    const orchestrator = new AgentOrchestrator();
    const agent = createMockAgent({ id: 'agent-1' });
    const task = createMockTask({ id: 'task-1' });

    orchestrator.registerAgent(agent);

    const assignedAgent = await orchestrator.assignTask(task);

    assert.equal(assignedAgent?.id, 'agent-1');
    assert.equal(task.assignedAgent, 'agent-1');
  });

  await t.test('should return null when no agents are available', async () => {
    const orchestrator = new AgentOrchestrator();
    const task = createMockTask({ id: 'task-1' });

    const assignedAgent = await orchestrator.assignTask(task);

    assert.equal(assignedAgent, null);
  });

  await t.test('should return null when all agents are busy', async () => {
    const orchestrator = new AgentOrchestrator();
    const agent = createMockAgent({ id: 'agent-1' });
    const task = createMockTask({ id: 'task-1' });

    orchestrator.registerAgent(agent);
    // Make agent busy by setting status
    agent.status = AgentStatus.BUSY;

    const assignedAgent = await orchestrator.assignTask(task);

    assert.equal(assignedAgent, null);
  });

  await t.test('should assign to first available agent', async () => {
    const orchestrator = new AgentOrchestrator();
    const agent1 = createMockAgent({ id: 'agent-1' });
    const agent2 = createMockAgent({ id: 'agent-2' });
    const task = createMockTask({ id: 'task-1' });

    orchestrator.registerAgent(agent1);
    orchestrator.registerAgent(agent2);

    const assignedAgent = await orchestrator.assignTask(task);

    assert.equal(assignedAgent?.id, 'agent-1');
  });

  await t.test('should skip unavailable agents', async () => {
    const orchestrator = new AgentOrchestrator();
    const agent1 = createMockAgent({ id: 'agent-1', available: false });
    const agent2 = createMockAgent({ id: 'agent-2' });
    const task = createMockTask({ id: 'task-1' });

    orchestrator.registerAgent(agent1);
    orchestrator.registerAgent(agent2);

    const assignedAgent = await orchestrator.assignTask(task);

    assert.equal(assignedAgent?.id, 'agent-2');
  });

  await t.test('should store task assignment', async () => {
    const orchestrator = new AgentOrchestrator();
    const agent = createMockAgent({ id: 'agent-1' });
    const task = createMockTask({ id: 'task-1' });

    orchestrator.registerAgent(agent);
    await orchestrator.assignTask(task);

    const assignment = orchestrator.getTaskAssignment('task-1');
    assert.equal(assignment, 'agent-1');
  });
});

test('AgentOrchestrator - getAvailableAgents', async (t) => {
  await t.test('should return only available agents', () => {
    const orchestrator = new AgentOrchestrator();
    const agent1 = createMockAgent({ id: 'agent-1' });
    const agent2 = createMockAgent({ id: 'agent-2' });
    const agent3 = createMockAgent({ id: 'agent-3', available: false });

    orchestrator.registerAgent(agent1);
    orchestrator.registerAgent(agent2);
    orchestrator.registerAgent(agent3);

    const available = orchestrator.getAvailableAgents();

    assert.equal(available.length, 2);
  });

  await t.test('should return empty array when no agents registered', () => {
    const orchestrator = new AgentOrchestrator();

    const available = orchestrator.getAvailableAgents();

    assert.equal(available.length, 0);
  });
});

test('AgentOrchestrator - initializeAll', async (t) => {
  await t.test('should initialize all registered agents', async () => {
    const orchestrator = new AgentOrchestrator();
    const agent1 = createMockAgent({ id: 'agent-1' });
    const agent2 = createMockAgent({ id: 'agent-2' });

    orchestrator.registerAgent(agent1);
    orchestrator.registerAgent(agent2);

    // Should not throw
    await orchestrator.initializeAll();
  });

  await t.test('should not throw when no agents registered', async () => {
    const orchestrator = new AgentOrchestrator();

    await orchestrator.initializeAll();
  });
});

test('AgentOrchestrator - cancelAllTasks', async (t) => {
  await t.test('should call cancelTask on all agents', async () => {
    const orchestrator = new AgentOrchestrator();
    const agent1 = createMockAgent({ id: 'agent-1' });
    const agent2 = createMockAgent({ id: 'agent-2' });

    orchestrator.registerAgent(agent1);
    orchestrator.registerAgent(agent2);

    await orchestrator.cancelAllTasks();

    assert.equal(agent1.wasCancelCalled(), true);
    assert.equal(agent2.wasCancelCalled(), true);
  });

  await t.test('should not throw when no agents registered', async () => {
    const orchestrator = new AgentOrchestrator();

    await orchestrator.cancelAllTasks();
  });
});

test('AgentOrchestrator - getAgentStatusReport', async (t) => {
  await t.test('should return a status report string', () => {
    const orchestrator = new AgentOrchestrator();
    const agent = createMockAgent({ id: 'agent-1', name: 'TestAgent' });

    orchestrator.registerAgent(agent);

    const report = orchestrator.getAgentStatusReport();

    assert.equal(typeof report, 'string');
    assert.ok(report.includes('Agent Status Report'));
    assert.ok(report.includes('TestAgent'));
  });

  await t.test('should show correct agent counts', () => {
    const orchestrator = new AgentOrchestrator();
    const agent1 = createMockAgent({ id: 'agent-1' });
    const agent2 = createMockAgent({ id: 'agent-2' });
    agent2.status = AgentStatus.BUSY;

    orchestrator.registerAgent(agent1);
    orchestrator.registerAgent(agent2);

    const report = orchestrator.getAgentStatusReport();

    assert.ok(report.includes('Total Agents: 2'));
  });
});

test('AgentOrchestrator - task assignment management', async (t) => {
  await t.test('should remove task assignment', async () => {
    const orchestrator = new AgentOrchestrator();
    const agent = createMockAgent({ id: 'agent-1' });
    const task = createMockTask({ id: 'task-1' });

    orchestrator.registerAgent(agent);
    await orchestrator.assignTask(task);

    orchestrator.removeTaskAssignment('task-1');

    const assignment = orchestrator.getTaskAssignment('task-1');
    assert.equal(assignment, undefined);
  });

  await t.test('should not throw when removing non-existent task assignment', () => {
    const orchestrator = new AgentOrchestrator();

    orchestrator.removeTaskAssignment('non-existent');
  });
});
