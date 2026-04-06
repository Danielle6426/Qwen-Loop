import winston from 'winston';
import chalk from 'chalk';

class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor(level: string = 'info') {
    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, agent, task }) => {
          const agentTag = agent ? chalk.cyan(`[${agent}]`) : '';
          const taskTag = task ? chalk.yellow(`[${task}]`) : '';
          
          const levels: Record<string, string> = {
            error: chalk.red('ERROR'),
            warn: chalk.yellow('WARN'),
            info: chalk.blue('INFO'),
            debug: chalk.gray('DEBUG')
          };

          return `${chalk.gray(timestamp)} ${levels[level]} ${agentTag}${taskTag} ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: 'logs/qwen-loop.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });
  }

  static getInstance(level?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(level);
    }
    return Logger.instance;
  }

  info(message: string, metadata?: { agent?: string; task?: string }) {
    this.logger.info(message, metadata);
  }

  warn(message: string, metadata?: { agent?: string; task?: string }) {
    this.logger.warn(message, metadata);
  }

  error(message: string, metadata?: { agent?: string; task?: string }) {
    this.logger.error(message, metadata);
  }

  debug(message: string, metadata?: { agent?: string; task?: string }) {
    this.logger.debug(message, metadata);
  }
}

export const logger = Logger.getInstance();

export function setLogLevel(level: 'error' | 'warn' | 'info' | 'debug') {
  Logger.getInstance(level);
}
