export class SpckEditor {
  constructor(iframe: Node | string, origin?: string);
  connect(opts?: ConnectOptions): Promise<ConnectMessage>;
  get(prop: string): Promise<unknown>;
  send(message: Message): Promise<{ success: true }>;
  on(handlers: HandlerConfig): void;
  getText(): Promise<string>;
  getMode(): Promise<string>;
  getPosition(): Promise<EditorPosition>;
  getTabSize(): Promise<number>;
  getTheme(): Promise<string>;
}

export interface Message {
  project?: string;
  clearProjects?: string[] | boolean;
  files?: FileConfig[];
  appendFiles?: boolean;
  open?: string | string[];
  editor?: EditorConfig;
}

export interface EmbeddedProject {
  dir: string;
  [key: string]: unknown;
}

export interface HandlerConfig {
  textChange?: (text: string, path: string | null) => void;
  selectionChange?: (selection: { selectedText: string; selectionRanges: SelectionRange[] }) => void;
  positionChange?: (position: EditorPosition) => void;
  fileOpen?: (path: string) => void;
  projectOpen?: (project: EmbeddedProject) => void;
  projectClose?: () => void;
  blur?: () => void;
  focus?: () => void;
}

export interface ConnectOptions {
  maxTries?: number;
  interval?: number;
}

export interface FileConfig {
  path: string;
  text?: string;
  url?: string;
}

export interface EditorConfig {
  mode?: string;
  text?: string;
  fontSize?: string;
  tabSize?: number;
  theme?: string;
  position?: EditorPosition;
  gutter?: boolean;
}

export interface SelectionRange {
  start: EditorPosition;
  end: EditorPosition;
}

export interface EditorPosition {
  row: number;
  column: number;
}

export interface ConnectMessage {
  tries: number;
}
