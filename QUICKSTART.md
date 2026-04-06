# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Qwen Code CLI

```bash
# Install Qwen Code CLI globally
npm install -g @qwen-code/qwen-code

# Or verify it's already installed
qwen --help
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Initialize Configuration
```bash
npm start -- init
```

This creates `qwen-loop.config.json` with example setup.

### 4. Configure Your Project Directory

Edit `qwen-loop.config.json`:
```json
{
  "workingDirectory": "./your-project-path",
  "agents": [
    {
      "name": "qwen-dev",
      "type": "qwen",
      "workingDirectory": "./your-project-path"
    }
  ]
}
```

### 5. Start the Loop!
```bash
npm start -- start
```

## 📋 Common Commands

```bash
# Initialize config
npm start -- init

# Start the loop
npm start -- start

# Validate configuration
npm start -- validate

# Show config details
npm start -- config

# Development mode (with auto-reload)
npm run dev
```

## 🎯 Example Tasks

Once the loop is running, tasks are automatically processed from the queue. You can programmatically add tasks:

```typescript
import { LoopManager, TaskPriority } from './src/index.js';

// In your code
loopManager.addTask(
  'Fix all TypeScript compilation errors',
  TaskPriority.CRITICAL
);

loopManager.addTask(
  'Implement user authentication',
  TaskPriority.HIGH
);

loopManager.addTask(
  'Add unit tests for API',
  TaskPriority.MEDIUM
);
```

## ⚙️ Configuration Tips

1. **Adjust Loop Interval**: Lower = faster processing (more resource usage)
   ```json
   "loopInterval": 3000  // 3 seconds
   ```

2. **Control Concurrency**: Limit simultaneous tasks
   ```json
   "maxConcurrentTasks": 2
   ```

3. **Set Retry Attempts**: Handle transient failures
   ```json
   "maxRetries": 5
   ```

4. **Multiple Agents**: Run multiple Qwen agents
   ```json
   "agents": [
     {"name": "qwen-coder", "type": "qwen"},
     {"name": "qwen-reviewer", "type": "qwen"}
   ]
   ```

## 📊 Monitoring

View real-time logs:
```bash
# On Unix/Linux/Mac
tail -f logs/qwen-loop.log

# On Windows
Get-Content logs/qwen-loop.log -Wait
```

## 🛑 Stopping the Loop

Press `Ctrl+C` to gracefully shut down the system.

## 🔧 Troubleshooting

**Issue**: "No agents configured"
- Run `npm start -- init` to create config
- Edit `qwen-loop.config.json` and add agents

**Issue**: "Qwen Code CLI not found"
- Install Qwen Code CLI: `npm install -g @qwen-code/qwen-code`
- Verify it's in PATH: `qwen --help`

**Issue**: Agents not executing tasks
- Check Qwen Code CLI is installed
- Verify working directory exists
- Check logs: `logs/qwen-loop.log`

## 📚 Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Explore [examples](qwen-loop.config.example.json) for configuration patterns
- Check the source code in `src/` to understand the architecture

---

**Happy autonomous coding!** 🤖✨
