import { Task, TaskPriority, TaskStatus } from '../types.js';
import { logger } from '../logger.js';
import { v4 as uuidv4 } from 'uuid';
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, extname, relative } from 'path';
import { spawn } from 'child_process';

interface ProjectAnalysis {
  files: FileMeta[];
  fileTypes: Map<string, number>;
  totalLines: number;
  hasTests: boolean;
  hasDocs: boolean;
  hasConfig: boolean;
  complexity: 'low' | 'medium' | 'high';
  largeFiles: FileMeta[];
  fileTree: string;
  recentChanges: string;
}

interface FileMeta {
  path: string;
  lines: number;
  extension: string;
}

interface AIGeneratedTask {
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL';
  reason: string;
  category?: string;
}

/**
 * Fallback templates if AI generation fails
 */
const FALLBACK_TASKS = [
  { description: 'Add unit tests for core modules', priority: TaskPriority.HIGH, category: 'tests' },
  { description: 'Improve documentation with examples and API reference', priority: TaskPriority.MEDIUM, category: 'docs' },
  { description: 'Review and fix TypeScript types, replace any "any" with proper types', priority: TaskPriority.MEDIUM, category: 'quality' },
  { description: 'Add error handling and validation to public APIs', priority: TaskPriority.MEDIUM, category: 'quality' },
  { description: 'Optimize slow operations and add caching where appropriate', priority: TaskPriority.LOW, category: 'performance' },
  { description: 'Review security: validate inputs, sanitize paths, prevent injection', priority: TaskPriority.HIGH, category: 'security' },
  { description: 'Improve CLI error messages with actionable suggestions', priority: TaskPriority.LOW, category: 'cli' },
  { description: 'Add structured logging with consistent field names', priority: TaskPriority.LOW, category: 'logging' },
];

/**
 * AI-powered task generator using Qwen CLI.
 * Analyzes project and calls Qwen to generate specific, contextual tasks.
 */
export class SelfTaskGenerator {
  private workingDir: string;
  private completedTaskSignatures: Set<string>;
  private qwenPath: string;

  constructor(workingDir: string) {
    this.workingDir = workingDir;
    this.completedTaskSignatures = new Set();
    const isWindows = process.platform === 'win32';
    this.qwenPath = process.env.QWEN_PATH || (isWindows ? 'qwen.cmd' : 'qwen');
  }

  /**
   * Analyze project structure and gather context for AI
   */
  analyzeProject(): ProjectAnalysis {
    const analysis: ProjectAnalysis = {
      files: [],
      fileTypes: new Map(),
      totalLines: 0,
      hasTests: false,
      hasDocs: false,
      hasConfig: false,
      complexity: 'low',
      largeFiles: [],
      fileTree: '',
      recentChanges: ''
    };

    this.walkDirectory(this.workingDir, analysis, 0, 2);

    if (analysis.totalLines > 5000) analysis.complexity = 'high';
    else if (analysis.totalLines > 1000) analysis.complexity = 'medium';

    analysis.hasTests = analysis.files.some(f =>
      f.path.includes('test') || f.path.includes('spec') || f.path.includes('__tests__')
    );
    analysis.hasDocs = analysis.files.some(f =>
      f.path.toLowerCase().includes('readme') || extname(f.path) === '.md'
    );
    analysis.hasConfig = analysis.files.some(f =>
      ['package.json', 'tsconfig.json'].some(name => f.path.includes(name))
    );

    analysis.largeFiles = analysis.files.filter(f => f.lines > 300);

    // Build file tree string for AI context
    analysis.fileTree = this.buildFileTree(analysis.files);

    // Get recent git changes for context
    analysis.recentChanges = this.getRecentChanges();

    return analysis;
  }

  /**
   * Generate tasks by calling Qwen AI with project analysis
   */
  generateTasks(analysis: ProjectAnalysis): Task[] {
    try {
      logger.info('🤖 Asking Qwen AI to analyze project and generate tasks...');
      const prompt = this.buildAIPrompt(analysis);
      const aiResponse = this.callQwenSync(prompt);

      if (aiResponse) {
        const tasks = this.parseAIResponse(aiResponse);
        if (tasks.length > 0) {
          logger.info(`✅ AI generated ${tasks.length} tasks`);
          return this.deduplicateAndPrioritize(tasks);
        }
      }

      logger.warn('⚠️ AI generation failed, using fallback templates');
      return this.generateFallbackTasks(analysis);
    } catch (error) {
      logger.error(`AI task generation error: ${error instanceof Error ? error.message : String(error)}`);
      return this.generateFallbackTasks(analysis);
    }
  }

  /**
   * Build prompt for Qwen AI to analyze project and generate tasks
   */
  private buildAIPrompt(analysis: ProjectAnalysis): string {
    return `You are an expert software architect analyzing a project to suggest improvement tasks.

## Project Analysis
- Files: ${analysis.files.length}
- Total lines: ${analysis.totalLines}
- Complexity: ${analysis.complexity}
- Has tests: ${analysis.hasTests ? 'Yes' : 'No'}
- Has documentation: ${analysis.hasDocs ? 'Yes' : 'No'}

## File Structure
${analysis.fileTree}

## Large Files (may need refactoring)
${analysis.largeFiles.length > 0 ? analysis.largeFiles.slice(0, 5).map(f =>
  `- ${relative(this.workingDir, f.path)} (${f.lines} lines, ${f.extension})`
).join('\n') : 'None'}

## Recent Changes
${analysis.recentChanges || 'No recent changes'}

## Task
Analyze this project and suggest 5-8 specific, actionable improvement tasks.

Requirements:
1. Each task should be SPECIFIC to this project (not generic advice)
2. Reference actual files, patterns, or issues you identify
3. Prioritize based on actual project needs
4. Avoid repeating tasks already done
5. Focus on: testing, code quality, documentation, performance, security

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {
    "description": "Specific task description referencing actual files/patterns",
    "priority": "HIGH|MEDIUM|LOW|CRITICAL",
    "reason": "Why this task is needed, referencing specific files or patterns",
    "category": "tests|quality|docs|performance|security|refactor|cli|logging|config"
  }
]`;
  }

  /**
   * Call Qwen CLI synchronously and return output
   */
  private callQwenSync(prompt: string): string | null {
    return new Promise<string | null>((resolve) => {
      const timeout = 120000; // 2 minutes timeout
      const timeoutId = setTimeout(() => {
        resolve(null);
      }, timeout);

      const args = [
        prompt,
        '--yolo',
        '-o', 'text',
        '--no-color'
      ];

      try {
        const qwenProcess = spawn(this.qwenPath, args, {
          cwd: this.workingDir,
          shell: true,
          windowsHide: true
        });

        let output = '';
        let errorOutput = '';

        qwenProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });

        qwenProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        qwenProcess.on('close', (code) => {
          clearTimeout(timeoutId);
          if (code === 0 && output.trim()) {
            resolve(output);
          } else {
            logger.debug(`Qwen exited with code ${code}, stderr: ${errorOutput.slice(0, 200)}`);
            resolve(null);
          }
        });

        qwenProcess.on('error', (error) => {
          clearTimeout(timeoutId);
          logger.debug(`Qwen spawn error: ${error.message}`);
          resolve(null);
        });
      } catch (error) {
        clearTimeout(timeoutId);
        logger.debug(`Qwen call failed: ${error instanceof Error ? error.message : String(error)}`);
        resolve(null);
      }
    });
  }

  /**
   * Parse AI response JSON into tasks
   */
  private parseAIResponse(response: string): Task[] {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Find JSON array
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      logger.debug('No JSON array found in AI response');
      return [];
    }

    try {
      const tasks: AIGeneratedTask[] = JSON.parse(arrayMatch[0]);

      return tasks
        .filter(t => t.description && t.priority)
        .map(t => ({
          id: uuidv4(),
          description: `${t.description} (Reason: ${t.reason || 'AI suggested'})`,
          priority: this.mapPriority(t.priority),
          status: TaskStatus.PENDING,
          createdAt: new Date(),
          metadata: {
            category: t.category || 'ai-generated',
            selfGenerated: true,
            aiGenerated: true,
            reason: t.reason
          }
        }));
    } catch (error) {
      logger.debug(`Failed to parse AI response as JSON: ${error instanceof Error ? error.message : String(error)}`);
      logger.debug(`Response preview: ${jsonStr.slice(0, 500)}...`);
      return [];
    }
  }

  /**
   * Deduplicate tasks and prioritize based on project needs
   */
  private deduplicateAndPrioritize(tasks: Task[]): Task[] {
    // Filter out completed tasks
    const uniqueTasks = tasks.filter(t => {
      const signature = t.description.slice(0, 50);
      if (this.completedTaskSignatures.has(signature)) {
        return false;
      }
      this.completedTaskSignatures.add(signature);
      return true;
    });

    // Limit to 8 tasks max
    const priorityOrder = [TaskPriority.CRITICAL, TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW];
    const sortedTasks = uniqueTasks.sort((a, b) => {
      return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    });

    return sortedTasks.slice(0, 8);
  }

  /**
   * Generate fallback tasks if AI generation fails
   */
  private generateFallbackTasks(analysis: ProjectAnalysis): Task[] {
    const tasks: Task[] = [];

    if (!analysis.hasTests) {
      tasks.push({
        id: uuidv4(),
        description: FALLBACK_TASKS[0].description,
        priority: FALLBACK_TASKS[0].priority,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        metadata: { category: FALLBACK_TASKS[0].category, selfGenerated: true, aiGenerated: false }
      });
    }

    if (!analysis.hasDocs) {
      tasks.push({
        id: uuidv4(),
        description: FALLBACK_TASKS[1].description,
        priority: FALLBACK_TASKS[1].priority,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        metadata: { category: FALLBACK_TASKS[1].category, selfGenerated: true, aiGenerated: false }
      });
    }

    if (analysis.largeFiles.length > 0) {
      const largeFile = analysis.largeFiles[0];
      tasks.push({
        id: uuidv4(),
        description: `Refactor ${relative(this.workingDir, largeFile.path)} (${largeFile.lines} lines) into smaller modules`,
        priority: TaskPriority.HIGH,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        metadata: { category: 'refactor', selfGenerated: true, aiGenerated: false }
      });
    }

    // Add 2-3 random quality tasks
    const shuffled = [...FALLBACK_TASKS].sort(() => Math.random() - 0.5);
    for (const task of shuffled.slice(2, 5)) {
      tasks.push({
        id: uuidv4(),
        description: task.description,
        priority: task.priority,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        metadata: { category: task.category, selfGenerated: true, aiGenerated: false }
      });
    }

    return tasks.slice(0, 6);
  }

  /**
   * Get the next task, generating new ones if pool is empty
   */
  getNextTask(analysis: ProjectAnalysis): Task | null {
    const tasks = this.generateTasks(analysis);
    return tasks.length > 0 ? tasks[0] : null;
  }

  /**
   * Reset completed task tracking
   */
  resetCompleted(): void {
    this.completedTaskSignatures.clear();
  }

  // Helper methods

  private walkDirectory(dir: string, analysis: ProjectAnalysis, depth: number, maxDepth: number): void {
    if (depth > maxDepth || !existsSync(dir)) return;

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (['node_modules', '.git', 'dist', 'logs'].includes(entry)) continue;

        const fullPath = join(dir, entry);
        try {
          const stats = statSync(fullPath);
          if (stats.isDirectory()) {
            this.walkDirectory(fullPath, analysis, depth + 1, maxDepth);
          } else if (stats.isFile()) {
            try {
              const content = readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n').length;
              const extension = extname(entry);

              analysis.files.push({ path: fullPath, lines, extension });
              analysis.totalLines += lines;

              const count = analysis.fileTypes.get(extension) || 0;
              analysis.fileTypes.set(extension, count + 1);
            } catch {
              // Skip unreadable files
            }
          }
        } catch {
          // Skip inaccessible files
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  private buildFileTree(files: FileMeta[]): string {
    const tree: string[] = [];
    const maxFiles = 30;

    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path)).slice(0, maxFiles);

    for (const file of sortedFiles) {
      const relPath = relative(this.workingDir, file.path);
      const parts = relPath.split(/[\\/]/);
      const indent = '  '.repeat(parts.length - 1);
      tree.push(`${indent}├── ${parts[parts.length - 1]} (${file.lines} lines)`);
    }

    if (files.length > maxFiles) {
      tree.push(`... and ${files.length - maxFiles} more files`);
    }

    return tree.join('\n');
  }

  private getRecentChanges(): string {
    try {
      const { spawnSync } = require('child_process');
      const result = spawnSync('git', ['log', '--oneline', '-5'], {
        cwd: this.workingDir,
        encoding: 'utf-8'
      });
      return result.stdout || '';
    } catch {
      return '';
    }
  }

  private mapPriority(priority: string): TaskPriority {
    const map: Record<string, TaskPriority> = {
      CRITICAL: TaskPriority.CRITICAL,
      HIGH: TaskPriority.HIGH,
      MEDIUM: TaskPriority.MEDIUM,
      LOW: TaskPriority.LOW
    };
    return map[priority.toUpperCase()] || TaskPriority.MEDIUM;
  }
}
