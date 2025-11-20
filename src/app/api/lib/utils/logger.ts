// Production-ready logging utility
import { env } from '../config/environment';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  error: LogLevel.ERROR,
  warn: LogLevel.WARN,
  info: LogLevel.INFO,
  debug: LogLevel.DEBUG,
};

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private currentLevel: LogLevel;

  constructor() {
    this.currentLevel = LOG_LEVEL_MAP[env.LOG_LEVEL] || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLevel;
  }

  private static formatLog(
    level: string,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (context) {
      logEntry.context = context;
    }

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return logEntry;
  }

  private static writeLog(logEntry: LogEntry): void {
    if (env.NODE_ENV === 'development') {
      // Pretty print for development
      console.log(JSON.stringify(logEntry, null, 2));
    } else {
      // Single line JSON for production (easier for log aggregation)
      console.log(JSON.stringify(logEntry));
    }
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const logEntry = Logger.formatLog('ERROR', message, context, error);
      Logger.writeLog(logEntry);
    }
  }

  warn(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const logEntry = Logger.formatLog('WARN', message, context);
      Logger.writeLog(logEntry);
    }
  }

  info(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const logEntry = Logger.formatLog('INFO', message, context);
      Logger.writeLog(logEntry);
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const logEntry = Logger.formatLog('DEBUG', message, context);
      Logger.writeLog(logEntry);
    }
  }

  // Database connection logging
  database(operation: string, database: string, success: boolean, error?: Error): void {
    const message = `Database ${operation}: ${database}`;
    const context = { operation, database, success };

    if (success) {
      this.info(message, context);
    } else {
      this.error(message, error, context);
    }
  }

  // API request logging (enhanced version of middleware logger)
  request(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    context?: Record<string, any>
  ): void {
    const message = `${method} ${url} - ${statusCode} (${responseTime}ms)`;
    const logContext = {
      method,
      url,
      statusCode,
      responseTime,
      ...context,
    };

    if (statusCode >= 500) {
      this.error(message, undefined, logContext);
    } else if (statusCode >= 400) {
      this.warn(message, logContext);
    } else {
      this.info(message, logContext);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing or custom instances
export { Logger };
