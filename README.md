# Qwen Loop - Autonomous Qwen Code CLI Loop System

A powerful framework that orchestrates **Qwen Code CLI** agents in continuous loops for autonomous 24/7 development, automatic updates, infinite fixes, and project evolution.

## 🚀 Features

- **Qwen Code CLI Only**: Uses Qwen Code CLI directly - no API keys needed
- **Multi-Agent Orchestration**: Run multiple Qwen agents simultaneously on different tasks
- **Continuous Loop System**: 24/7 autonomous operation with configurable intervals
- **Priority Task Queue**: Intelligent task scheduling with priority levels (Critical, High, Medium, Low)
- **Automatic Retry**: Failed tasks are automatically retried with configurable attempts
- **Extensible Architecture**: Easy to add custom CLI agents
- **Real-time Monitoring**: Track agent status, task progress, and system statistics
- **Flexible Configuration**: JSON-based configuration with validation
- **CLI Interface**: Easy-to-use command-line interface for control and monitoring

## 📦 Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd Qwen-Loop

# Install dependencies
npm install

# Initialize configuration
npm start -- init
```

## 🛠 Quick Start

### 1. Install Qwen Code CLI

First, make sure Qwen Code CLI is installed and available in your PATH:

```bash
# Install Qwen Code CLI globally
npm install -g @anthropic-ai/qwen-code

# Or verify it's already installed
qwen --help
```

### 2. Initialize Configuration

```bash
npm install
npm start -- init
```

This creates a `qwen-loop.config.json` file with example configuration.

### 3. Configure Your Project

Edit `qwen-loop.config.json`:

```json
{
  "agents": [
    {
      "name": "qwen-dev",
      "type": "qwen",
      "workingDirectory": "./your-project"
    }
  ],
  "maxConcurrentTasks": 3,
  "loopInterval": 5000,
  "maxRetries": 3,
  "workingDirectory": "./your-project",
  "logLevel": "info"
}
```

### 4. Start the Loop

```bash
npm start -- start
```

Or in development mode:

```bash
npm run dev
```

## 📖 Usage

### CLI Commands

```bash
# Generate example configuration
npm start -- init

# Start the agent loop
npm start -- start

# Add a task (programmatic)
npm start -- add-task "Fix all TypeScript errors" --priority high

# Show status
npm start -- status

# Show configuration
npm start -- config

# Validate configuration
npm start -- validate
```

### Programmatic Usage

```typescript
import { 
  LoopManager, 
  ConfigManager, 
  TaskPriority,
  QwenAgent
} from 'qwen-loop';

// Create configuration
const configManager = new ConfigManager();
const config = configManager.getConfig();

// Create loop manager
const loopManager = new LoopManager(config);

// Create and register Qwen agent
const qwenAgent = new QwenAgent({
  name: 'qwen-dev',
  type: 'qwen',
  workingDirectory: './project'
});

loopManager.getOrchestrator().registerAgent(qwenAgent);

// Add tasks
loopManager.addTask(
  'Implement user authentication system',
  TaskPriority.HIGH
);

loopManager.addTask(
  'Fix all TypeScript compilation errors',
  TaskPriority.CRITICAL
);

// Start the loop
await loopManager.start();

// Monitor progress
setInterval(() => {
  console.log(loopManager.getStats());
}, 10000);
```

## ⚙️ Configuration

### Loop Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `agents` | AgentConfig[] | [] | List of agent configurations |
| `maxConcurrentTasks` | number | 3 | Maximum number of tasks running simultaneously |
| `loopInterval` | number | 5000 | Time between loop iterations (milliseconds) |
| `maxRetries` | number | 3 | Maximum retry attempts for failed tasks |
| `workingDirectory` | string | process.cwd() | Default working directory for agents |
| `logLevel` | string | 'info' | Logging level (error, warn, info, debug) |
| `enableAutoStart` | boolean | false | Auto-start loop on initialization |

### Agent Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | ✓ | Unique agent identifier |
| `type` | AgentType | ✓ | Agent type (qwen, custom) |
| `model` | string | | Model name/identifier |
| `maxTokens` | number | | Maximum tokens for responses |
| `timeout` | number | | Task execution timeout (ms) |
| `workingDirectory` | string | | Agent-specific working directory |
| `additionalArgs` | string[] | | Additional CLI arguments |

## 🏗 Architecture

### Core Components

1. **BaseAgent**: Abstract base class for all agents
   - QwenAgent: Adapter for Qwen Code CLI
   - CustomAgent: Extensible adapter for any CLI tool

2. **AgentOrchestrator**: Manages agent registration, task assignment, and coordination

3. **TaskQueue**: Priority-based task queue with scheduling

4. **LoopManager**: Controls the continuous execution loop

5. **ConfigManager**: Handles configuration loading, validation, and persistence

6. **Logger**: Centralized logging system with colored output

### Task Flow

```
Task Creation → Task Queue → Orchestrator → Agent Assignment → Task Execution → Result Handling
                                                                    ↓
                                                              (Success/Failure)
                                                                    ↓
                                                          Retry or Complete
```

## 🎯 Task Priorities

- **CRITICAL**: Highest priority, processed first
- **HIGH**: Important tasks, processed second
- **MEDIUM**: Normal tasks, processed third
- **LOW**: Background tasks, processed last

## 📊 Monitoring

The system provides detailed status reports:

### Agent Status Report
```
=== Agent Status Report ===
Total Devices: 2
Available: 1
Busy: 1
Error: 0

🟢 qwen-dev (qwen) - idle
🔴 claude-reviewer (claude) - busy
```

### Task Queue Stats
```
=== Task Queue Stats ===
Total Tasks: 10
Pending in Queue: 3

By Priority:
  critical: 1
  high: 1
  medium: 1
  LOW: 0

By Status:
  PENDING: 3
  RUNNING: 1
  COMPLETED: 5
  FAILED: 1
```

## 🔧 Extending

### Adding Custom Agents

You can add any CLI-based AI coding tool:

```typescript
import { CustomAgent } from 'qwen-loop';

const customAgent = new CustomAgent({
  name: 'my-ai-tool',  // CLI command name
  type: 'custom',
  workingDirectory: './project',
  additionalArgs: ['--custom-flag']
});
```

### Creating Custom Agent Classes

```typescript
import { BaseAgent } from 'qwen-loop';

export class MyCustomAgent extends BaseAgent {
  protected async onInitialize(): Promise<void> {
    // Initialization logic
  }

  protected async onExecuteTask(task: Task, signal: AbortSignal): Promise<AgentResult> {
    // Task execution logic
    return {
      success: true,
      output: 'Task completed',
      executionTime: 1000
    };
  }
}
```

## 📝 Logging

Logs are stored in `logs/qwen-loop.log` with rotation (5MB max, 5 files).

View logs in real-time:
```bash
tail -f logs/qwen-loop.log
```

## 🛡 Best Practices

1. **Set Appropriate Timeouts**: Prevent agents from running indefinitely
2. **Use Priority Levels**: Critical fixes should be high priority, features can be medium/low
3. **Monitor Resource Usage**: Keep an eye on API rate limits
4. **Configure Retries**: Balance between resilience and avoiding infinite loops
5. **Working Directory**: Use project-specific directories to avoid conflicts
6. **Log Level**: Use 'debug' for troubleshooting, 'info' for normal operation

## 🔍 Troubleshooting

### Agent Not Starting
- Verify Qwen Code CLI is installed: `qwen --help`
- Check Qwen Code is in your PATH
- Review logs: `logs/qwen-loop.log`

### Tasks Failing
- Increase timeout in agent configuration
- Check task description is valid
- Review error messages in logs
- Increase maxRetries for transient failures

### High Memory Usage
- Reduce maxConcurrentTasks
- Increase loopInterval
- Monitor agent process count

## 📋 Requirements

- Node.js 18+ 
- npm or yarn
- Qwen Code CLI (installed globally or in PATH)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📄 License

ISC

## 🌟 Example Use Cases

1. **Automated Code Review**: Agents continuously review and improve code quality
2. **Bug Fixing Pipeline**: Automatically detect and fix common issues
3. **Feature Development**: Agents work on implementing new features
4. **Documentation Updates**: Keep documentation in sync with code
5. **Test Generation**: Automatically generate and maintain test suites
6. **Refactoring**: Continuous code improvement and modernization
7. **Dependency Updates**: Automated dependency management and updates

## 📞 Support

For issues and questions:
- Check the logs: `logs/qwen-loop.log`
- Validate configuration: `npm start -- validate`
- Review this README

---

**Built for autonomous development with AI agents** 🤖
