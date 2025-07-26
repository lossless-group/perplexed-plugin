import { App, Editor as ObsidianEditor, MarkdownView, Modal, Notice as ObsidianNotice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

declare module 'obsidian' {
  interface App {
    commands: any;
  }
  
  interface Editor extends ObsidianEditor {
    getSelection(): string;
    replaceSelection(text: string): void;
    replaceRange(text: string, from: { line: number, ch: number }, to?: { line: number, ch: number }): void;
    getCursor(from?: boolean): { line: number, ch: number };
    setCursor(line: number, ch: number): void;
    lastLine(): number;
    getLine(line: number): string;
  }

  interface Notice extends ObsidianNotice {
    // Extend if needed with additional methods
  }

  interface MarkdownView {
    file: TFile;
    editor: Editor;
  }

  interface PluginManifest {
    dir: string;
  }

  // Additional utility types for LM Studio service
  interface LMStudioOptions {
    system_prompt?: string;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    return_images?: boolean;
    [key: string]: any; // For additional options
  }

  interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'function';
    content: string;
    name?: string;
    function_call?: {
      name: string;
      arguments: string;
    };
  }

  interface LMStudioResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
      index: number;
      message: {
        role: string;
        content: string;
      };
      finish_reason: string;
    }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }
}
