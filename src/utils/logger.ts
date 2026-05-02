import { Notice } from 'obsidian';
import type { Vault } from 'obsidian';
import { TFile } from 'obsidian';

interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  details?: unknown;
  stack?: string;
}

export class FileLogger {
  private static instance: FileLogger;
  private logFile: string = 'freepik-errors.json';
  private vault: Vault | null = null;
  private logEntries: LogEntry[] = [];
  private isSaving = false;
  private saveQueue: (() => Promise<void>)[] = [];

  private constructor() {}

  static getInstance(): FileLogger {
    if (!FileLogger.instance) {
      FileLogger.instance = new FileLogger();
    }
    return FileLogger.instance;
  }

  initialize(vault: Vault): void {
    this.vault = vault;
    this.loadLogs().catch(error => {
      console.error('Failed to load logs:', error);
    });
  }

  private async loadLogs(): Promise<void> {
    if (!this.vault) return;

    try {
      const file = this.vault.getAbstractFileByPath(this.logFile);
      if (file instanceof TFile) {
        const content = await this.vault.read(file);
        this.logEntries = JSON.parse(content);
      }
    } catch (error) {
      // File doesn't exist or is corrupted, start with empty logs
      this.logEntries = [];
    }
  }

  private async saveLogs(): Promise<void> {
    if (!this.vault || this.isSaving) {
      // If already saving, queue this save for later
      if (!this.isSaving) {
        this.saveQueue.push(() => this.saveLogs());
      }
      return;
    }

    this.isSaving = true;
    
    try {
      await this.vault.adapter.write(
        this.logFile,
        JSON.stringify(this.logEntries, null, 2)
      );
    } catch (error) {
      console.error('Failed to save logs:', error);
      new Notice('Failed to save error logs. Check console for details.');
    } finally {
      this.isSaving = false;
      
      // Process any queued saves
      const nextSave = this.saveQueue.shift();
      if (nextSave) {
        await nextSave();
      }
    }
  }

  private addEntry(level: LogEntry['level'], message: string, details?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details: details instanceof Error ? {
        message: details.message,
        name: details.name,
        stack: details.stack
      } : details
    };

    this.logEntries.push(entry);
    
    // Keep only the last 1000 entries
    if (this.logEntries.length > 1000) {
      this.logEntries = this.logEntries.slice(-1000);
    }

    this.saveLogs().catch(error => {
      console.error('Failed to save log entry:', error);
    });

    // Also log to console
    const logMethod = console[level] || console.log;
    logMethod(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`, details || '');
  }

  error(message: string, details?: unknown): void {
    this.addEntry('error', message, details);
  }

  warn(message: string, details?: unknown): void {
    this.addEntry('warn', message, details);
  }

  info(message: string, details?: unknown): void {
    this.addEntry('info', message, details);
  }

  debug(message: string, details?: unknown): void {
    this.addEntry('debug', message, details);
  }

  getLogs(limit: number = 100): LogEntry[] {
    return [...this.logEntries].reverse().slice(0, limit);
  }

  async clearLogs(): Promise<void> {
    this.logEntries = [];
    await this.saveLogs();
  }
}

// Export a singleton instance
export const logger = FileLogger.getInstance();
