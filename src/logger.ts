import winston from 'winston';
import chalk from 'chalk';

/**
 * Extended log metadata that can be attached to log messages
 */
export interface LogMetadata {
  /** Agent identifier */
  agent?: string;
  /** Task identifier */
  task?: string;
  /** Project name (for multi-project mode) */
  project?: string;
  /** Duration in milliseconds */
  duration?: number;
  /** Error object for error logs */
  error?: Error | unknown;
  /** Additional custom metadata */
  [key: string]: unknown;
}

/**
 * Structured log entry format for file output
 */
interface StructuredLogEntry {
  timestamp: string;
  level: string;
  message: string;
  agent?: string;
  task?: string;
  project?: string;
  duration?: number;
  error?: string;
  [key: string]: unknown;
}

/**
 * Sanitize sensitive data from log metadata
 * Removes or masks API keys, tokens, passwords, etc.
 */
function sanitizeMetadata(metadata: LogMetadata): LogMetadata {
  const sanitized: LogMetadata = { ...metadata };
  const sensitiveKeys = ['apikey', 'api_key', 'token', 'secret', 'password', 'authorization', 'auth'];
  
  for (const [key, value] of Object.entries(sanitized)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && /(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S+/i.test(value)) {
      sanitized[key] = value.replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)\S+/gi, '$1[REDACTED]');
    }
  }
  
  return sanitized;
}

/**
 * Logger singleton class that provides structured, colorized logging
 * with support for console and file outputs.
 */
class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor(level: string = 'info') {
    // Console format: human-readable with colors
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, agent, task, project, duration, ...meta }) => {
        const agentTag = agent ? chalk.cyan(`[${agent}]`) : '';
        const taskTag = task ? chalk.yellow(`[Task:${task}]`) : '';
        const projectTag = project ? chalk.magenta(`[${project}]`) : '';
        const durationTag = duration !== undefined ? chalk.green(`[${duration}ms]`) : '';

        const levels: Record<string, string> = {
          error: chalk.red('ERROR'),
          warn: chalk.yellow('WARN '),
          info: chalk.blue('INFO '),
          debug: chalk.gray('DEBUG')
        };

        let logLine = `${chalk.gray(timestamp)} ${levels[level]} ${agentTag}${projectTag}${taskTag}${durationTag} ${message}`;
        
        // Add any additional metadata that doesn't have dedicated tags
        const remainingMeta = Object.entries(meta).filter(([key]) => 
          !['timestamp', 'level', 'message', Symbol.for('level')].includes(key)
        );
        
        if (remainingMeta.length > 0) {
          const metaStr = remainingMeta.map(([k, v]) => `${k}=${v}`).join(' ');
          logLine += chalk.gray(` {${metaStr}}`);
        }
        
        return logLine;
      })
    );

    // File format: structured JSON for analysis
    const fileFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format((info) => {
        const structured: any = {
          timestamp: String(info.timestamp || ''),
          level: info.level,
          message: String(info.message || '')
        };
        
        if (info.agent) structured.agent = String(info.agent);
        if (info.task) structured.task = String(info.task);
        if (info.project) structured.project = String(info.project);
        if (info.duration !== undefined && info.duration !== null) {
          structured.duration = Number(info.duration);
        }
        if (info.error) {
          structured.error = info.error instanceof Error ? (info.error.stack || info.error.message) : String(info.error);
        }
        
        // Add remaining metadata fields
        Object.entries(info).forEach(([key, value]) => {
          if (!['timestamp', 'level', 'message', 'agent', 'task', 'project', 'duration', 'error', Symbol.for('level')].includes(key)) {
            structured[key] = value;
          }
        });
        
        return structured;
      })(),
      winston.format.json()
    );

    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format((info) => {
          // Sanitize metadata before logging
          if (info.agent || info.task || info.project || info.error) {
            const sanitized = sanitizeMetadata(info);
            Object.assign(info, sanitized);
          }
          return info;
        })(),
        winston.format.combine(consoleFormat)
      ),
      transports: [
        new winston.transports.Console({
          format: consoleFormat
        }),
        new winston.transports.File({
          filename: 'logs/qwen-loop.log',
          format: fileFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });
  }

  /**
   * Get or create the Logger singleton instance
   * @param level - Optional log level to set on creation
   * @returns The Logger instance
   */
  static getInstance(level?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(level);
    }
    return Logger.instance;
  }

  /**
   * Log an informational message
   * @param message - The message to log
   * @param metadata - Optional metadata (agent, task, project, duration, etc.)
   */
  info(message: string, metadata?: LogMetadata) {
    this.logger.info(message, metadata);
  }

  /**
   * Log a warning message
   * @param message - The message to log
   * @param metadata - Optional metadata (agent, task, project, duration, etc.)
   */
  warn(message: string, metadata?: LogMetadata) {
    this.logger.warn(message, metadata);
  }

  /**
   * Log an error message
   * @param message - The message to log
   * @param metadata - Optional metadata (agent, task, project, error, etc.)
   */
  error(message: string, metadata?: LogMetadata) {
    this.logger.error(message, metadata);
  }

  /**
   * Log a debug message
   * @param message - The message to log
   * @param metadata - Optional metadata (agent, task, project, duration, etc.)
   */
  debug(message: string, metadata?: LogMetadata) {
    this.logger.debug(message, metadata);
  }
}

export const logger = Logger.getInstance();

/**
 * Set the global log level
 * @param level - The logging level to use
 */
export function setLogLevel(level: 'error' | 'warn' | 'info' | 'debug') {
  Logger.getInstance(level);
}
