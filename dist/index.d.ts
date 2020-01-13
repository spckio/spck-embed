export class SpckEditor {
  constructor(iframe: Node | string);

  connect(opts: ConnectOptions): Promise<ConnectMessage>;
  get(prop: string): Promise<any>;
  send(message: Message): Promise<any>;
  on(handlers: HandlerConfig): void
  getText(): Promise<string>;
  getMode(): Promise<string>;
  getPosition(): Promise<EditorPosition>;
  getTheme(): Promise<string>;
}

interface Message {
  project?: string;
  clearProjects?: [string] | boolean;
  files?: [FileConfig];
  appendFiles?: Boolean;
  open?: string;
  editor?: EditorConfig;
}

interface HandlerConfig {
  textChange: (text: string) => void;
  selectionChange: ({selectedText: string, selectionRanges: [SelectionRange]}) => void;
  positionChange: (position: EditorPosition) => void;
  fileOpen: (path: string) => void;
  projectOpen: (project: string) => void;
  projectClose: () => void;
  blur: () => void;
  focus: () => void;
}

interface ConnectOptions {
  maxTries?: number;
  interval?: number;
}

interface FileConfig {
  path: string;
  text?: string;
  url?: string;
}

interface EditorConfig {
  mode?: string;
  tabSize?: number;
  theme?: string;
  position?: EditorConfig;
}

interface SelectionRange {
  start: EditorPosition;
  end: EditorPosition;
}

interface EditorPosition {
  row: number;
  column: number;
}

interface ConnectMessage {
  tries: number
}
