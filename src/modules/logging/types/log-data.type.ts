/**
 * Type definitions for logging module
 */

/**
 * Represents data that can be logged
 */
export type LogData = string | number | boolean | null | undefined | LogObject | LogData[];

/**
 * Object that can be logged
 */
export interface LogObject {
  [key: string]: LogData;
}

/**
 * Metadata for log entries
 */
export interface LogMetadata extends LogObject {
  context?: string;
  requestId?: string;
  timestamp?: string;
  level?: string;
}

/**
 * Error log data
 */
export interface ErrorLogData extends LogObject {
  message?: string;
  stack?: string;
  code?: string | number;
  name?: string;
}
