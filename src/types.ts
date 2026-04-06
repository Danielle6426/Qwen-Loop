// Agent types and interfaces
export enum AgentType {
  QWEN = 'qwen',
  CUSTOM = 'custom'
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AgentStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error',
  OFFLINE = 'offline'
}

export interface Task {
  id: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedAgent?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AgentConfig {
  name: string;
  type: AgentType;
  model?: string;
  maxTokens?: number;
  timeout?: number;
  workingDirectory?: string;
  additionalArgs?: string[];
}

export interface AgentResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  filesModified?: string[];
  filesCreated?: string[];
  filesDeleted?: string[];
}

export interface IAgent {
  readonly id: string;
  readonly name: string;
  readonly type: AgentType;
  status: AgentStatus;
  
  initialize(): Promise<void>;
  executeTask(task: Task): Promise<AgentResult>;
  cancelTask(): Promise<void>;
  getStatus(): AgentStatus;
  isAvailable(): boolean;
}

export interface IAgentOrchestrator {
  registerAgent(agent: IAgent): void;
  removeAgent(agentId: string): void;
  assignTask(task: Task): Promise<IAgent | null>;
  getAvailableAgents(): IAgent[];
  getAllAgents(): IAgent[];
}

export interface ITaskQueue {
  enqueue(task: Task): void;
  dequeue(): Task | null;
  peek(): Task | null;
  isEmpty(): boolean;
  size(): number;
  getTasksByStatus(status: TaskStatus): Task[];
  getAllTasks(): Task[];
}

export interface ILoopManager {
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  isRunning(): boolean;
  getStats(): LoopStats;
}

export interface LoopStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  activeAgents: number;
  uptime: number;
  averageExecutionTime: number;
  loopIterations?: number;
  maxLoopIterations?: number;
}

export interface ProjectConfig {
  name: string;
  workingDirectory: string;
  agents?: AgentConfig[]; // Override global agents for this project
  maxConcurrentTasks?: number; // Override global setting
  maxLoopIterations?: number; // Override global setting
}

export interface LoopConfig {
  agents: AgentConfig[];
  maxConcurrentTasks: number;
  loopInterval: number; // milliseconds between loops
  maxRetries: number;
  workingDirectory: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableAutoStart: boolean;
  maxLoopIterations?: number; // Max number of loop iterations (0 = unlimited)
  enableSelfTaskGeneration?: boolean; // Auto-generate tasks by analyzing project
  projects?: ProjectConfig[]; // Multi-project mode: list of projects to cycle through
}
