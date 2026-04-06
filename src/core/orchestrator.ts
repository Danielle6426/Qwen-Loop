import { IAgent, IAgentOrchestrator, Task, AgentStatus } from '../types.js';
import { logger } from '../logger.js';

export class AgentOrchestrator implements IAgentOrchestrator {
  private agents: Map<string, IAgent> = new Map();
  private taskAssignments: Map<string, string> = new Map(); // taskId -> agentId

  registerAgent(agent: IAgent): void {
    this.agents.set(agent.id, agent);
    logger.info(`Agent ${agent.name} (${agent.id}) registered with orchestrator`, { 
      agent: agent.name 
    });
  }

  removeAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      // Cancel any running tasks
      agent.cancelTask();
      this.agents.delete(agentId);
      
      // Remove task assignments
      for (const [taskId, assignedAgentId] of this.taskAssignments.entries()) {
        if (assignedAgentId === agentId) {
          this.taskAssignments.delete(taskId);
        }
      }
      
      logger.info(`Agent ${agent.name} removed from orchestrator`, { agent: agent.name });
    }
  }

  async assignTask(task: Task): Promise<IAgent | null> {
    const availableAgents = this.getAvailableAgents();
    
    if (availableAgents.length === 0) {
      logger.warn('No available agents to assign task');
      return null;
    }

    // Select the first available agent (can be enhanced with load balancing, priority, etc.)
    const selectedAgent = availableAgents[0];
    
    this.taskAssignments.set(task.id, selectedAgent.id);
    task.assignedAgent = selectedAgent.id;
    
    logger.info(`Task ${task.id} assigned to agent ${selectedAgent.name}`, { 
      agent: selectedAgent.name, 
      task: task.id 
    });

    return selectedAgent;
  }

  getAvailableAgents(): IAgent[] {
    const available: IAgent[] = [];
    
    for (const agent of this.agents.values()) {
      if (agent.isAvailable()) {
        available.push(agent);
      }
    }
    
    return available;
  }

  getAllAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  getAgentById(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  getTaskAssignment(taskId: string): string | undefined {
    return this.taskAssignments.get(taskId);
  }

  removeTaskAssignment(taskId: string): void {
    this.taskAssignments.delete(taskId);
  }

  getAgentStatusReport(): string {
    let report = '\n=== Agent Status Report ===\n';
    report += `Total Agents: ${this.agents.size}\n`;
    report += `Available: ${this.getAvailableAgents().length}\n`;
    report += `Busy: ${this.getAllAgents().filter(a => a.getStatus() === AgentStatus.BUSY).length}\n`;
    report += `Error: ${this.getAllAgents().filter(a => a.getStatus() === AgentStatus.ERROR).length}\n\n`;
    
    for (const agent of this.agents.values()) {
      const status = agent.getStatus();
      const statusIcon = status === AgentStatus.IDLE ? '🟢' : 
                         status === AgentStatus.BUSY ? '🔴' : 
                         status === AgentStatus.ERROR ? '❌' : '⚫';
      report += `${statusIcon} ${agent.name} (${agent.type}) - ${status}\n`;
    }
    
    return report;
  }

  async initializeAll(): Promise<void> {
    logger.info('Initializing all agents...');
    
    const initPromises = Array.from(this.agents.values()).map(async (agent) => {
      try {
        await agent.initialize();
      } catch (error) {
        logger.error(`Failed to initialize agent ${agent.name}: ${error}`, { 
          agent: agent.name 
        });
      }
    });

    await Promise.all(initPromises);
    
    logger.info('All agents initialization complete');
  }

  async cancelAllTasks(): Promise<void> {
    const cancelPromises = Array.from(this.agents.values()).map(async (agent) => {
      try {
        await agent.cancelTask();
      } catch (error) {
        logger.error(`Error cancelling task for agent ${agent.name}: ${error}`, { 
          agent: agent.name 
        });
      }
    });

    await Promise.all(cancelPromises);
  }
}
