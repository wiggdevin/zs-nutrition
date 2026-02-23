export interface LogContext {
  jobId?: string;
  queue?: string;
  attempt?: number;
  attemptsMade?: number;
  maxAttempts?: number;
  error?: string;
  failedReason?: string;
  failedAt?: string;
  originalJobId?: string;
  [key: string]: unknown;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDev = process.env.NODE_ENV !== 'production';

  private formatDevMessage(level: LogLevel, message: string, context?: LogContext): string {
    const emoji = this.getEmoji(level);
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `${emoji} ${message}${contextStr}`;
  }

  private getEmoji(level: LogLevel): string {
    switch (level) {
      case 'debug':
        return '🔍';
      case 'info':
        return 'ℹ️';
      case 'warn':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '•';
    }
  }

  private formatProdMessage(level: LogLevel, message: string, context?: LogContext): string {
    const output = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    };
    return JSON.stringify(output);
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const formatted = this.isDev
      ? this.formatDevMessage(level, message, context)
      : this.formatProdMessage(level, message, context);

    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }
}

export const logger = new Logger();
