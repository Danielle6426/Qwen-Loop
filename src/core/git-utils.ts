import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../logger.js';

/**
 * Ensure .qwen/settings.json exists with YOLO mode enabled
 * This is the official way to set persistent auto-approve per Qwen docs
 */
function ensureYoloSettings(cwd: string): void {
  const qwenDir = join(cwd, '.qwen');
  if (!existsSync(qwenDir)) {
    mkdirSync(qwenDir, { recursive: true });
  }

  const settingsPath = join(qwenDir, 'settings.json');
  const settings = {
    permissions: {
      defaultMode: 'yolo',
      confirmShellCommands: false,
      confirmFileEdits: false
    }
  };

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  logger.debug('Ensured .qwen/settings.json with YOLO mode');
}

/**
 * Run a command and return stdout/stderr
 * @param cmd - The command to execute
 * @param args - Command arguments
 * @param cwd - Working directory for the command
 * @returns Promise resolving to an object with stdout and stderr
 */
function run(cmd: string, args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true, windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      resolve({ stdout, stderr });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Run git add + commit + push after each task
 * @param message - The commit message to use
 * @param cwd - The working directory for git operations
 * @returns Object indicating success/failure and output/error message
 */
export async function gitCommitPush(
  message: string,
  cwd: string
): Promise<{ success: boolean; output: string }> {
  try {
    // Ensure YOLO mode is set persistently (official approach per docs)
    ensureYoloSettings(cwd);

    // Check if there are changes to commit
    const { stdout: statusOut } = await run('git', ['status', '--porcelain'], cwd);

    if (!statusOut.trim()) {
      logger.debug('No changes to commit');
      return { success: true, output: 'No changes to commit' };
    }

    // git add -A
    await run('git', ['add', '-A'], cwd);

    // git commit
    await run('git', ['commit', '-m', message], cwd);
    logger.debug(`Committed: ${message.slice(0, 50)}...`);

    // git push
    await run('git', ['push'], cwd);

    return { success: true, output: 'Changes committed and pushed' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Git operation failed: ${msg}`);
    return { success: false, output: msg };
  }
}
