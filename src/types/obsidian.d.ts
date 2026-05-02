import type { TFile } from 'obsidian';

declare module 'obsidian' {
  interface CommandsApi {
    commands: Record<string, unknown>;
  }

  interface App {
    commands: CommandsApi;
  }
  
  interface Editor {
    getSelection(): string;
    replaceSelection(text: string): void;
    getCursor(): { line: number, ch: number };
    setCursor(line: number, ch: number): void;
    lastLine(): number;
  }

  interface MarkdownView {
    file: TFile;
    editor: Editor;
  }

  interface PluginManifest {
    dir: string;
  }
}
