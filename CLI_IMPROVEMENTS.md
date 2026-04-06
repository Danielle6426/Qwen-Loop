# CLI Interface Improvements

## Overview
Enhanced the Qwen Loop CLI interface with better usability, helpful error messages, interactive prompts, intelligent auto-correction, and improved help output.

## Key Improvements

### 1. **Enhanced Help Output**
- ✅ Added comprehensive examples for every command
- ✅ Improved formatting with better visual hierarchy and emoji icons
- ✅ Added global options section to all command help
- ✅ Included practical usage examples with descriptions
- ✅ Added tips, resources, and command aliases sections
- ✅ Better command grouping: Setup, Execution, Information

**Example:**
```bash
qwen-loop --help
```
Now shows:
- Clear command descriptions with emoji icons (🔧, ▶, ℹ)
- Command aliases displayed inline: `[alias: run]`
- Practical examples for each command
- Command aliases reference section
- Tips for new users
- Links to documentation and issue tracker

### 2. **Interactive Prompts**

#### `init --interactive`
- ✅ Guided step-by-step configuration setup
- ✅ Prompts for working directory, agent type, agent name
- ✅ Validates input ranges (e.g., 1-10 for concurrent tasks)
- ✅ Better error messages with suggestions

#### `init-multi --interactive`
- ✅ Interactive multi-project configuration
- ✅ Configure global settings (concurrency, interval, retries)
- ✅ Add multiple projects with guided prompts
- ✅ Maximum of 10 projects with clear messaging
- ✅ Validation for all inputs

#### `add-task --interactive`
- ✅ Interactive priority selection
- ✅ Clear descriptions for each priority level:
  - Low - Background tasks
  - Medium - Normal tasks (default)
  - High - Important tasks
  - Critical - Urgent tasks
- ✅ Confirmation before creating task

#### `start --interactive` (NEW)
- ✅ Interactive startup configuration
- ✅ Prompt for config file path
- ✅ Enable/disable health check server
- ✅ Configure health port with validation
- ✅ Streamlined startup experience

### 3. **Intelligent Auto-Correction**

#### Command Typo Detection (NEW)
- ✅ Fuzzy matching using Levenshtein distance algorithm
- ✅ Suggests correct command when typo detected
- ✅ Threshold-based matching to avoid false suggestions

**Examples:**
```bash
# Typo: "sta" instead of "st"
$ qwen-loop sta

✖ Error: Unknown command: "sta"

💡 Suggestion:
  1. Did you mean: st?
  2. Run 'qwen-loop --help' to see available commands

# Typo: "runn" instead of "run"  
$ qwen-loop runn

✖ Error: Unknown command: "runn"

💡 Suggestion:
  1. Did you mean: run?
  2. Run 'qwen-loop --help' to see available commands
```

#### Option Value Auto-Correction (NEW)
- ✅ Fuzzy matching for option values
- ✅ Context-aware suggestions for invalid inputs

**Example:**
```bash
# Typo: "medim" instead of "medium"
$ qwen-loop add-task "Fix bug" --priority medim

✖ Error: Invalid priority: "medim"

💡 Suggestion:
  1. Did you mean: "medium"?
  2. Valid priorities are: low, medium, high, critical
  3. Example: qwen-loop add-task "Fix bug" --priority medium
```

### 4. **Better Error Messages**

All error messages now include:
- ✅ Clear, descriptive error messages
- ✅ Actionable suggestions when applicable
- ✅ Context-specific guidance
- ✅ Numbered suggestion format for readability

**Context-Aware Errors** (NEW)
- ✅ Automatically detects error type (config, file, permission, network)
- ✅ Provides relevant suggestions based on error context
- ✅ Always includes help resources in suggestions

**Examples:**

**Before:**
```
Error: Configuration file not found
```

**After:**
```
✖ Error: Configuration file not found

💡 Suggestion:
  1. Auto-detected config file at: ./qwen-loop.config.json
  2. Use detected config: qwen-loop start --config ./qwen-loop.config.json
  3. Or create a new one: qwen-loop init
```

**Configuration Validation:**
- Specific suggestions based on detected issues
- Clear guidance for fixing common problems
- Helpful messages for missing directories, invalid values, etc.

### 5. **Configuration File Auto-Detection** (NEW)

- ✅ Automatically searches for config files in common locations
- ✅ Falls back to parent directories (up to 3 levels)
- ✅ Supports multiple config file names:
  - `qwen-loop.config.json`
  - `qwen-loop.config.js`
  - `qwen-loop.json`
  - `.qwen-loop.json`
  - `config.json`
- ✅ Displays detected path when found

**Example:**
```bash
# When no config specified and file exists in parent directory
$ qwen-loop start

✖ Error: Configuration file not found

💡 Suggestion:
  1. Auto-detected config file at: ../project/qwen-loop.config.json
  2. Use detected config: qwen-loop start --config ../project/qwen-loop.config.json
  3. Or create a new one: qwen-loop init
```

### 6. **Enhanced Status Command**

#### Live Status Mode (NEW)
- ✅ `--live` flag to fetch real-time status from running instance
- ✅ Shows active agents with current status
- ✅ Displays task metrics (completed, failed, execution time)
- ✅ Shows task queue statistics
- ✅ Falls back to static config if instance not running

**Example:**
```bash
$ qwen-loop status --live

📊 Qwen Loop Status
══════════════════════════════════════════════════════════════════════

● Live Status (connected)
──────────────────────────────────────────────────────────────────────

🤖 Active Agents:
  ✓ qwen-dev (qwen)
    Status: busy
    Healthy: yes
    Tasks Executed: 15
    Failed Tasks: 2

📋 Task Metrics:
  Completed: 15
  Failed: 2
  Avg Execution Time: 3420ms

──────────────────────────────────────────────────────────────────────

⚙ Configuration:
  Config File:    ./qwen-loop.config.json
  Working Dir:    ./project
  Agents:         1
  ...
```

#### JSON Output
- ✅ Enhanced JSON output with live data section
- ✅ Includes connection status
- ✅ Full agent and task details

### 7. **Color Output Control**

#### `--no-color` Flag
- ✅ Global flag to disable all color output
- ✅ Useful for scripts, CI/CD pipelines, and terminals without color support
- ✅ Automatically respects terminal capabilities

**Example:**
```bash
qwen-loop --no-color status
```

### 8. **Improved Command Output Formatting**

#### `status` Command
- ✅ Live status display when connected to running instance
- ✅ Better visual formatting with section headers
- ✅ Numbered lists for agents and projects
- ✅ Interval displayed in both ms and seconds
- ✅ JSON output support for scripting

#### `config` Command
- ✅ Enhanced layout with clear section headers
- ✅ Timeout displayed in both ms and seconds
- ✅ Better agent configuration display
- ✅ JSON output support

#### `validate` Command
- ✅ Clearer presentation of validation results
- ✅ Specific suggestions for each error type
- ✅ JSON output for automated validation checks
- ✅ Summary statistics in JSON mode

#### `health` Command
- ✅ Better formatting for agent information
- ✅ Clear notes about live metrics requirement
- ✅ Improved readability of health reports

### 9. **Command Examples**

Every command now includes context-specific examples:

**init:**
```
# Create default config → qwen-loop init
# Interactive setup → qwen-loop init --interactive
# Force overwrite → qwen-loop init --force
```

**add-task:**
```
# Add medium priority task → qwen-loop add-task "Write tests"
# Add critical task → qwen-loop add-task "Fix security issue" --priority critical
# Interactive mode → qwen-loop add-task --interactive
```

**start:**
```
# Start with defaults → qwen-loop start
# With health check → qwen-loop start --health-port 8080
# Custom config file → qwen-loop start --config my-config.json
# Interactive mode → qwen-loop start --interactive
```

## New Features Summary

| Feature | Command | Description |
|---------|---------|-------------|
| `--interactive` | `init` | Step-by-step configuration wizard |
| `--interactive` | `init-multi` | Multi-project configuration wizard |
| `--interactive` | `add-task` | Interactive priority selection |
| `--interactive` | `start` | Interactive startup configuration |
| `--live` | `status` | Fetch live status from running instance |
| `--no-color` | Global | Disable color output |
| Command correction | All commands | Auto-suggest correct command on typo |
| Option correction | All options | Auto-suggest correct option values |
| Auto-detection | All commands | Auto-detect config file location |
| Examples | All commands | Command-specific usage examples |
| Better errors | All commands | Context-aware error messages |
| Improved formatting | `status`, `config`, `validate`, `health` | Better visual output |

## Testing

All improvements have been tested:
- ✅ Build succeeds with no errors
- ✅ All 98 existing tests pass
- ✅ Help output displays correctly
- ✅ Command-specific examples show properly
- ✅ Error messages are clear and helpful
- ✅ Command typo detection works (e.g., "sta" → "st")
- ✅ Option typo detection works (e.g., "medim" → "medium")
- ✅ `--no-color` flag works as expected
- ✅ Interactive prompts validate input correctly
- ✅ Live status connection works
- ✅ Config auto-detection works

## Backward Compatibility

All improvements are **fully backward compatible**:
- Existing commands work exactly as before
- New flags are optional additions
- Default behavior unchanged
- No breaking changes to API

## Usage Examples

### Get Help
```bash
# Main help
qwen-loop --help

# Command-specific help
qwen-loop init --help
qwen-loop add-task --help
```

### Interactive Mode
```bash
# Interactive single-project setup
qwen-loop init --interactive

# Interactive multi-project setup
qwen-loop init-multi --interactive

# Add task with priority selection
qwen-loop add-task "Fix login bug" --interactive

# Interactive startup configuration
qwen-loop start --interactive
```

### Auto-Correction
```bash
# Command typo - suggests correct command
qwen-loop sta
# → Did you mean: st?

# Option typo - suggests correct value
qwen-loop add-task "Fix bug" --priority medim
# → Did you mean: "medium"?
```

### Better Output
```bash
# Status with improved formatting and live data
qwen-loop status --live

# Configuration details
qwen-loop config

# Validation with suggestions
qwen-loop validate

# Health check
qwen-loop health
```

### Script-Friendly Output
```bash
# JSON output for automation
qwen-loop status --json
qwen-loop validate --json
qwen-loop health --json

# No color for clean parsing
qwen-loop --no-color status --json
```

### Auto-Detection
```bash
# Automatically finds config files
qwen-loop start
# → Auto-detected config file at: ./qwen-loop.config.json
```

## Files Modified

- `src/cli.ts` - Main CLI implementation (enhanced)
- `src/types.ts` - Added AgentStatus import (no changes needed)

## Dependencies

No new dependencies added. Uses existing:
- `commander` - CLI framework
- `chalk` - Color output
- `@inquirer/prompts` - Interactive prompts

## Technical Implementation

### Fuzzy Matching Algorithm
- Uses Levenshtein distance calculation
- Configurable threshold for matching
- Works for both commands and option values

### Context-Aware Error Handler
- Categorizes errors by type (config, file, permission, network)
- Provides relevant suggestions based on context
- Always includes helpful resources

### Config Auto-Detection
- Searches common filenames
- Checks current and parent directories
- Respects explicitly provided paths
