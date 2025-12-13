/**
 * File logging utility for query timing logs
 * Writes logs to local files with rotation support
 */

import { promises as fs } from 'fs';
import { join } from 'path';

const LOGS_DIR = process.env.QUERY_LOGS_DIR || join(process.cwd(), 'logs');
const ENABLE_FILE_LOGGING = process.env.ENABLE_QUERY_FILE_LOGGING !== 'false'; // Default to true

// Ensure logs directory exists
let logsDirInitialized = false;

async function ensureLogsDirectory(): Promise<void> {
  if (logsDirInitialized) return;
  
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    logsDirInitialized = true;
  } catch (error) {
    console.error('[FILE_LOGGER] Failed to create logs directory:', error);
    // Continue anyway - will fail on write attempt
  }
}

/**
 * Gets the log file path for today
 */
function getLogFilePath(): string {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return join(LOGS_DIR, `query-timing-${dateStr}.log`);
}

/**
 * Writes a log entry to file (JSON Lines format - one JSON object per line)
 */
export async function writeLogToFile(logData: any): Promise<void> {
  if (!ENABLE_FILE_LOGGING) {
    return; // File logging disabled
  }

  try {
    await ensureLogsDirectory();
    
    const logFilePath = getLogFilePath();
    const logLine = JSON.stringify(logData) + '\n';
    
    // Append to file (creates file if it doesn't exist)
    await fs.appendFile(logFilePath, logLine, 'utf8');
  } catch (error) {
    // Don't throw - logging failures shouldn't break the application
    // Just log to console as fallback
    console.error('[FILE_LOGGER] Failed to write log to file:', error);
  }
}

/**
 * Writes multiple log entries to file (batch write)
 */
export async function writeLogsToFile(logDataArray: any[]): Promise<void> {
  if (!ENABLE_FILE_LOGGING || logDataArray.length === 0) {
    return;
  }

  try {
    await ensureLogsDirectory();
    
    const logFilePath = getLogFilePath();
    const logLines = logDataArray.map(data => JSON.stringify(data)).join('\n') + '\n';
    
    await fs.appendFile(logFilePath, logLines, 'utf8');
  } catch (error) {
    console.error('[FILE_LOGGER] Failed to write logs to file:', error);
  }
}

/**
 * Reads log file for a specific date
 */
export async function readLogFile(date?: string): Promise<string[]> {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const logFilePath = join(LOGS_DIR, `query-timing-${targetDate}.log`);
    
    const content = await fs.readFile(logFilePath, 'utf8');
    return content.split('\n').filter(line => line.trim().length > 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []; // File doesn't exist yet
    }
    throw error;
  }
}

/**
 * Gets list of available log files
 */
export async function listLogFiles(): Promise<string[]> {
  try {
    await ensureLogsDirectory();
    const files = await fs.readdir(LOGS_DIR);
    return files.filter(file => file.startsWith('query-timing-') && file.endsWith('.log'));
  } catch (error) {
    console.error('[FILE_LOGGER] Failed to list log files:', error);
    return [];
  }
}

