// Quick test script
import { LoopManager, ConfigManager, QwenAgent, TaskPriority } from './index.js';
import { setLogLevel } from './logger.js';

async function test() {
  console.log('\n🧪 Testing Qwen Loop...\n');

  // Set debug log level
  setLogLevel('debug');

  // Create config
  const config = {
    agents: [
      {
        name: 'qwen-test',
        type: 'qwen' as any,
        workingDirectory: process.cwd()
      }
    ],
    maxConcurrentTasks: 1,
    loopInterval: 3000,
    maxRetries: 1,
    workingDirectory: process.cwd(),
    logLevel: 'debug' as any,
    enableAutoStart: false
  };

  // Create loop manager
  const loopManager = new LoopManager(config);

  // Create and register Qwen agent
  const agent = new QwenAgent({
    name: 'qwen-test',
    type: 'qwen' as any,
    workingDirectory: process.cwd()
  });

  loopManager.getOrchestrator().registerAgent(agent);

  // Initialize agent
  console.log('Initializing agent...');
  try {
    await agent.initialize();
    console.log('✅ Agent initialized successfully\n');
  } catch (error: any) {
    console.log(`❌ Agent initialization failed: ${error.message}\n`);
    process.exit(1);
  }

  // Add test tasks
  console.log('Adding test tasks...\n');
  
  loopManager.addTask(
    'Create a file called hello.txt with "Hello from Qwen Loop!"',
    TaskPriority.HIGH
  );

  // Start the loop
  console.log('Starting loop...\n');
  await loopManager.start();

  // Wait for task completion
  await new Promise(resolve => setTimeout(resolve, 45000));

  // Print stats
  const stats = loopManager.getStats();
  console.log('\n📊 Loop Stats:');
  console.log(`  Total tasks: ${stats.totalTasks}`);
  console.log(`  Completed: ${stats.completedTasks}`);
  console.log(`  Failed: ${stats.failedTasks}`);
  console.log(`  Running: ${stats.runningTasks}`);
  console.log(`  Avg execution time: ${stats.averageExecutionTime.toFixed(0)}ms`);

  // Print agent status
  console.log(loopManager.getAgentStatusReport());

  // Stop
  console.log('\nStopping loop...');
  await loopManager.stop();
  console.log('✅ Test complete!\n');

  process.exit(0);
}

test().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
