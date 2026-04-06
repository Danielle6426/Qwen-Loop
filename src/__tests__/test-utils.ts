import { IAgent, Task, AgentStatus, AgentType, AgentResult, TaskPriority, TaskStatus } from '../types.js';

/**
 * Creates a mock task for testing
 */
export function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id || 'test-task-' + Math.random().toString(36).slice(2, 9),
    description: overrides.description || 'Test task',
    priority: overrides.priority || TaskPriority.MEDIUM,
    status: overrides.status || TaskStatus.PENDING,
    createdAt: overrides.createdAt || new Date(),
    ...overrides
  };
}

/**
 * Creates a mock agent for testing
 */
export function createMockAgent(overrides: {
  id?: string;
  name?: string;
  type?: AgentType;
  available?: boolean;
  status?: AgentStatus;
  executeResult?: AgentResult;
  executeDelay?: number;
  throwOnExecute?: boolean;
} = {}): MockAgent {
  return new MockAgent(overrides);
}

/**
 * Mock agent implementation for testing
 */
export class MockAgent implements IAgent {
  readonly id: string;
  readonly name: string;
  readonly type: AgentType;
  status: AgentStatus = AgentStatus.IDLE;

  private _available: boolean;
  private _executeResult: AgentResult;
  private _executeDelay: number;
  private _throwOnExecute: boolean;
  private _executedTasks: Task[] = [];
  private _cancelCalled = false;

  constructor(overrides: {
    id?: string;
    name?: string;
    type?: AgentType;
    available?: boolean;
    status?: AgentStatus;
    executeResult?: AgentResult;
    executeDelay?: number;
    throwOnExecute?: boolean;
  } = {}) {
    this.id = overrides.id || 'agent-' + Math.random().toString(36).slice(2, 9);
    this.name = overrides.name || 'Test Agent';
    this.type = overrides.type || AgentType.CUSTOM;
    this._available = overrides.available !== false;
    this.status = overrides.status || AgentStatus.IDLE;
    this._executeResult = overrides.executeResult || { success: true, executionTime: 100 };
    this._executeDelay = overrides.executeDelay || 0;
    this._throwOnExecute = overrides.throwOnExecute || false;
  }

  async initialize(): Promise<void> {
    // No-op for mock
  }

  async executeTask(task: Task): Promise<AgentResult> {
    this._executedTasks.push(task);
    this.status = AgentStatus.BUSY;

    if (this._throwOnExecute) {
      throw new Error('Mock agent execute error');
    }

    if (this._executeDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this._executeDelay));
    }

    this.status = AgentStatus.IDLE;
    return { ...this._executeResult };
  }

  async cancelTask(): Promise<void> {
    this._cancelCalled = true;
    this.status = AgentStatus.IDLE;
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  isAvailable(): boolean {
    return this._available && this.status === AgentStatus.IDLE;
  }

  // Test helpers
  setAvailable(available: boolean): void {
    this._available = available;
  }

  setExecuteResult(result: AgentResult): void {
    this._executeResult = result;
  }

  getExecutedTasks(): Task[] {
    return [...this._executedTasks];
  }

  wasCancelCalled(): boolean {
    return this._cancelCalled;
  }

  reset(): void {
    this._executedTasks = [];
    this._cancelCalled = false;
    this.status = AgentStatus.IDLE;
    this._available = true;
  }
}

/**
 * Simple test assertion helpers (compatible with node:test)
 */
export function assertEqual(actual: unknown, expected: unknown, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assert(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

export function assertNull(value: unknown, message?: string): void {
  if (value !== null) {
    throw new Error(`${message || 'Expected null'}: got ${JSON.stringify(value)}`);
  }
}

export function assertNotNull(value: unknown, message?: string): void {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected non-null value');
  }
}

export function assertThrows(fn: () => void, message?: string): void {
  try {
    fn();
    throw new Error(message || 'Expected function to throw');
  } catch {
    // Expected
  }
}

export async function assertRejects(fn: () => Promise<void>, message?: string): Promise<void> {
  try {
    await fn();
    throw new Error(message || 'Expected promise to reject');
  } catch {
    // Expected
  }
}
