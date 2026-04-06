import { IAgent, AgentStatus, TaskStatus, TaskPriority, HealthReport, AgentHealthStatus, ResourceUsage, TaskThroughput, PriorityBreakdown } from '../types.js';
import { logger } from '../logger.js';
import { execSync } from 'child_process';
import { platform } from 'os';
import * as os from 'os';

/**
 * Health checker that collects comprehensive system metrics
 * including agent health, task throughput, error rates, and resource usage.
 */
export class HealthChecker {
  private agents: IAgent[] = [];
  private loopStartTime: Date | null = null;
  private completedTasksCount = 0;
  private failedTasksCount = 0;
  private totalExecutionTime = 0;
  private maxConcurrentTasks = 0;
  private loopInterval = 0;
  private maxRetries = 0;
  private workingDirectory = '';
  private taskQueue: Map<string, { status: TaskStatus; priority: TaskPriority }> = new Map();
  private agentTaskCounts: Map<string, { total: number; failed: number }> = new Map();
  private agentLastTaskTime: Map<string, number> = new Map();

  /**
   * Update the health checker with current agent information
   */
  updateAgents(agents: IAgent[]): void {
    this.agents = agents;
  }

  /**
   * Update loop statistics
   */
  updateLoopStats(stats: {
    loopStartTime?: Date | null;
    completedTasks?: number;
    failedTasks?: number;
    totalExecutionTime?: number;
    maxConcurrentTasks?: number;
    loopInterval?: number;
    maxRetries?: number;
    workingDirectory?: string;
  }): void {
    if (stats.loopStartTime !== undefined) this.loopStartTime = stats.loopStartTime;
    if (stats.completedTasks !== undefined) this.completedTasksCount = stats.completedTasks;
    if (stats.failedTasks !== undefined) this.failedTasksCount = stats.failedTasks;
    if (stats.totalExecutionTime !== undefined) this.totalExecutionTime = stats.totalExecutionTime;
    if (stats.maxConcurrentTasks !== undefined) this.maxConcurrentTasks = stats.maxConcurrentTasks;
    if (stats.loopInterval !== undefined) this.loopInterval = stats.loopInterval;
    if (stats.maxRetries !== undefined) this.maxRetries = stats.maxRetries;
    if (stats.workingDirectory !== undefined) this.workingDirectory = stats.workingDirectory;
  }

  /**
   * Update task queue information
   */
  updateTaskQueue(tasks: Array<{ id: string; status: TaskStatus; priority: TaskPriority }>): void {
    this.taskQueue.clear();
    for (const task of tasks) {
      this.taskQueue.set(task.id, { status: task.status, priority: task.priority });
    }
  }

  /**
   * Track task execution for agent-specific metrics
   */
  trackTaskCompletion(agentId: string, success: boolean, executionTime: number): void {
    const counts = this.agentTaskCounts.get(agentId) || { total: 0, failed: 0 };
    counts.total++;
    if (!success) counts.failed++;
    this.agentTaskCounts.set(agentId, counts);
    this.agentLastTaskTime.set(agentId, Date.now());
  }

  /**
   * Generate a comprehensive health report
   */
  generateHealthReport(): HealthReport {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Collect agent health
    const agentHealth = this.getAgentHealth(warnings, errors);

    // Collect resource usage
    const resources = this.getResourceUsage();

    // Calculate task throughput
    const throughput = this.getTaskThroughput();

    // Get priority breakdown
    const priorityBreakdown = this.getPriorityBreakdown();

    // Determine overall status
    const status = this.determineOverallStatus(agentHealth, resources, throughput, warnings, errors);

    const uptime = this.loopStartTime ? Date.now() - this.loopStartTime.getTime() : 0;

    const summary = this.generateSummary(status, agentHealth, throughput, resources);

    return {
      status,
      timestamp: new Date(),
      uptime,
      agents: agentHealth,
      taskThroughput: throughput,
      priorityBreakdown,
      resources,
      config: {
        maxConcurrentTasks: this.maxConcurrentTasks,
        loopInterval: this.loopInterval,
        maxRetries: this.maxRetries,
        agentCount: this.agents.length,
        workingDirectory: this.workingDirectory
      },
      summary,
      warnings,
      errors
    };
  }

  /**
   * Format health report for console output
   */
  formatReportForConsole(report: HealthReport): string {
    let output = '\n╔══════════════════════════════════════════════════════════╗\n';
    output +=    '║          Qwen Loop - System Health Report               ║\n';
    output +=    '╚══════════════════════════════════════════════════════════╝\n\n';

    // Overall status
    const statusIcon = report.status === 'healthy' ? '🟢' : report.status === 'degraded' ? '🟡' : '🔴';
    output += `${statusIcon} Overall Status: ${report.status.toUpperCase()}\n`;
    output += `📅 Timestamp: ${report.timestamp.toISOString()}\n`;
    output += `⏱️  Uptime: ${this.formatUptime(report.uptime)}\n\n`;

    // Summary
    output += `📊 Summary: ${report.summary}\n\n`;

    // Agent Health
    output += '━━━ Agent Health ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    output += `Total Agents: ${report.agents.length}\n`;
    const healthyAgents = report.agents.filter(a => a.healthy).length;
    const busyAgents = report.agents.filter(a => a.status === AgentStatus.BUSY).length;
    const errorAgents = report.agents.filter(a => a.status === AgentStatus.ERROR).length;
    output += `Healthy: ${healthyAgents} | Busy: ${busyAgents} | Errors: ${errorAgents}\n\n`;

    for (const agent of report.agents) {
      const icon = agent.healthy ? (agent.status === AgentStatus.BUSY ? '🔴' : '🟢') : '❌';
      output += `${icon} ${agent.name} (${agent.type})\n`;
      output += `   Status: ${agent.status} | Tasks: ${agent.totalTasksExecuted} | Failed: ${agent.failedTasks}\n`;
      if (agent.timeSinceLastTask !== undefined && agent.timeSinceLastTask > 0) {
        output += `   Last Task: ${this.formatUptime(agent.timeSinceLastTask)} ago\n`;
      }
      if (agent.error) {
        output += `   ⚠️  Error: ${agent.error}\n`;
      }
    }
    output += '\n';

    // Task Throughput
    output += '━━━ Task Throughput ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    const tp = report.taskThroughput;
    output += `Total: ${tp.totalTasks} | Completed: ${tp.completedTasks} | Failed: ${tp.failedTasks}\n`;
    output += `Running: ${tp.runningTasks} | Pending: ${tp.pendingTasks}\n`;
    output += `Throughput: ${tp.tasksPerMinute.toFixed(2)} tasks/min\n`;
    output += `Avg Time: ${tp.averageExecutionTime.toFixed(0)}ms\n`;
    output += `Success Rate: ${tp.successRate.toFixed(1)}% | Error Rate: ${tp.errorRate.toFixed(1)}%\n\n`;

    // Priority Breakdown
    output += '━━━ Priority Breakdown ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    for (const [priority, count] of Object.entries(report.priorityBreakdown.byPriority)) {
      if (count > 0) {
        output += `  ${priority}: ${count}\n`;
      }
    }
    output += '\nBy Status:\n';
    for (const [status, count] of Object.entries(report.priorityBreakdown.byStatus)) {
      if (count > 0) {
        output += `  ${status}: ${count}\n`;
      }
    }
    output += '\n';

    // Resource Usage
    output += '━━━ Resource Usage ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    const res = report.resources;
    output += `CPU: ${res.cpuUsage.toFixed(1)}%\n`;
    output += `Memory: ${(res.memoryUsage / 1024 / 1024).toFixed(1)} MB (${res.memoryUsagePercent.toFixed(1)}%)\n`;
    output += `Heap: ${(res.heapUsed / 1024 / 1024).toFixed(1)} MB / ${(res.heapLimit / 1024 / 1024).toFixed(1)} MB\n`;
    output += `Active Processes: ${res.activeProcesses}\n\n`;

    // Configuration
    output += '━━━ Configuration ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    output += `Max Concurrent: ${report.config.maxConcurrentTasks} | Interval: ${report.config.loopInterval}ms\n`;
    output += `Max Retries: ${report.config.maxRetries} | Agents: ${report.config.agentCount}\n\n`;

    // Warnings and Errors
    if (report.warnings.length > 0) {
      output += '⚠️  Warnings:\n';
      for (const warning of report.warnings) {
        output += `  - ${warning}\n`;
      }
      output += '\n';
    }

    if (report.errors.length > 0) {
      output += '❌ Errors:\n';
      for (const error of report.errors) {
        output += `  - ${error}\n`;
      }
      output += '\n';
    }

    return output;
  }

  /**
   * Generate a compact JSON-friendly health report
   */
  getJsonReport(): HealthReport {
    return this.generateHealthReport();
  }

  // Private methods

  private getAgentHealth(warnings: string[], errors: string[]): AgentHealthStatus[] {
    return this.agents.map(agent => {
      const status = agent.getStatus();
      const counts = this.agentTaskCounts.get(agent.id) || { total: 0, failed: 0 };
      const lastTaskTime = this.agentLastTaskTime.get(agent.id);
      const timeSinceLastTask = lastTaskTime ? Date.now() - lastTaskTime : undefined;

      const healthy = status !== AgentStatus.ERROR && status !== AgentStatus.OFFLINE;
      let error: string | undefined;

      if (status === AgentStatus.ERROR) {
        error = 'Agent is in error state';
        errors.push(`Agent ${agent.name} is in error state`);
      } else if (status === AgentStatus.OFFLINE) {
        error = 'Agent is offline';
        errors.push(`Agent ${agent.name} is offline`);
      }

      // Check for high failure rate
      if (counts.total > 0) {
        const failureRate = (counts.failed / counts.total) * 100;
        if (failureRate > 50) {
          warnings.push(`Agent ${agent.name} has high failure rate: ${failureRate.toFixed(1)}%`);
        }
      }

      // Check if agent has been busy for too long
      if (status === AgentStatus.BUSY && timeSinceLastTask && timeSinceLastTask > 300000) {
        warnings.push(`Agent ${agent.name} has been busy for >5 minutes`);
      }

      return {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status,
        healthy,
        timeSinceLastTask,
        totalTasksExecuted: counts.total,
        failedTasks: counts.failed,
        error
      };
    });
  }

  private getResourceUsage(): ResourceUsage {
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    // Get CPU usage (platform-specific)
    let cpuUsage = 0;
    try {
      if (platform() === 'win32') {
        // Windows: use wmic
        const output = execSync('wmic cpu get loadpercentage', { encoding: 'utf8' });
        const match = output.match(/(\d+)/);
        cpuUsage = match ? parseInt(match[1]) : 0;
      } else {
        // Unix: use top
        const output = execSync("top -l 1 | grep 'CPU usage' | awk '{print $3}'", { encoding: 'utf8', timeout: 2000 });
        cpuUsage = parseFloat(output) || 0;
      }
    } catch {
      // Fallback: estimate from process CPU usage
      const cpus = os.cpus();
      cpuUsage = this.estimateCpuUsage();
    }

    // Count active child processes
    const activeProcesses = this.agents.filter(a => a.getStatus() === AgentStatus.BUSY).length;

    return {
      cpuUsage,
      memoryUsage: memUsage.rss,
      memoryUsagePercent,
      memoryTotal: totalMemory,
      memoryFree: freeMemory,
      heapSize: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      heapLimit: memUsage.heapTotal, // V8 heap limit is typically the total
      uptime: process.uptime() * 1000,
      activeProcesses
    };
  }

  private estimateCpuUsage(): number {
    // Simple estimation based on process CPU time
    const startUsage = process.cpuUsage();
    const start = Date.now();
    
    // Measure over a short period
    return new Promise<number>(resolve => {
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const elapsed = Date.now() - start;
        const totalCpuTime = (endUsage.user + endUsage.system) / 1000; // Convert to ms
        const cpuPercent = (totalCpuTime / elapsed) * 100;
        resolve(Math.min(cpuPercent, 100));
      }, 100);
    }) as unknown as number;
  }

  private getTaskThroughput(): TaskThroughput {
    const totalTasks = this.completedTasksCount + this.failedTasksCount;
    const uptime = this.loopStartTime ? (Date.now() - this.loopStartTime.getTime()) / 1000 : 0;
    const uptimeMinutes = uptime / 60;
    
    const tasksPerMinute = uptimeMinutes > 0 ? this.completedTasksCount / uptimeMinutes : 0;
    const averageExecutionTime = this.completedTasksCount > 0 ? this.totalExecutionTime / this.completedTasksCount : 0;
    const errorRate = totalTasks > 0 ? (this.failedTasksCount / totalTasks) * 100 : 0;
    const successRate = totalTasks > 0 ? (this.completedTasksCount / totalTasks) * 100 : 100;

    const runningTasks = Array.from(this.taskQueue.values()).filter(t => t.status === TaskStatus.RUNNING).length;
    const pendingTasks = Array.from(this.taskQueue.values()).filter(t => t.status === TaskStatus.PENDING).length;

    return {
      totalTasks,
      completedTasks: this.completedTasksCount,
      failedTasks: this.failedTasksCount,
      runningTasks,
      pendingTasks,
      tasksPerMinute,
      averageExecutionTime,
      errorRate,
      successRate
    };
  }

  private getPriorityBreakdown(): PriorityBreakdown {
    const byPriority: Record<TaskPriority, number> = {
      [TaskPriority.CRITICAL]: 0,
      [TaskPriority.HIGH]: 0,
      [TaskPriority.MEDIUM]: 0,
      [TaskPriority.LOW]: 0
    };

    const byStatus: Record<TaskStatus, number> = {
      [TaskStatus.PENDING]: 0,
      [TaskStatus.RUNNING]: 0,
      [TaskStatus.COMPLETED]: 0,
      [TaskStatus.FAILED]: 0,
      [TaskStatus.CANCELLED]: 0
    };

    for (const task of this.taskQueue.values()) {
      byPriority[task.priority]++;
      byStatus[task.status]++;
    }

    return { byPriority, byStatus };
  }

  private determineOverallStatus(
    agents: AgentHealthStatus[],
    resources: ResourceUsage,
    throughput: TaskThroughput,
    warnings: string[],
    errors: string[]
  ): 'healthy' | 'degraded' | 'unhealthy' {
    // Unhealthy conditions
    if (errors.length > 0) return 'unhealthy';
    if (agents.every(a => !a.healthy)) return 'unhealthy';
    if (resources.memoryUsagePercent > 95) return 'unhealthy';
    if (throughput.errorRate > 50) return 'unhealthy';

    // Degraded conditions
    if (warnings.length > 0) return 'degraded';
    if (agents.some(a => !a.healthy)) return 'degraded';
    if (resources.memoryUsagePercent > 80) return 'degraded';
    if (throughput.errorRate > 20) return 'degraded';
    if (resources.heapUsed / resources.heapLimit > 0.9) return 'degraded';

    return 'healthy';
  }

  private generateSummary(
    status: string,
    agents: AgentHealthStatus[],
    throughput: TaskThroughput,
    resources: ResourceUsage
  ): string {
    const parts: string[] = [];

    parts.push(`${agents.filter(a => a.healthy).length}/${agents.length} agents healthy`);
    parts.push(`${throughput.completedTasks} tasks completed`);
    parts.push(`${throughput.successRate.toFixed(1)}% success rate`);
    parts.push(`${resources.memoryUsagePercent.toFixed(1)}% memory used`);

    return parts.join(' | ');
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}
