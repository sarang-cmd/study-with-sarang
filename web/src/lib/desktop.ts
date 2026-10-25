import type { IconId } from './iconSet';
/** The narrow bridge the desktop shell exposes as window.desktop (see electron/preload.cjs). */
export interface ShortcutResult { id: string; accelerator: string; ok: boolean; active: boolean; reason?: string; warning?: string }
export type VoiceStatus = 'off' | 'starting' | 'listening' | 'error' | 'unsupported';
export type VoiceEvent =
  | { type: 'status'; status: VoiceStatus; language?: string; culture?: string; code?: string; message?: string }
  | { type: 'heard'; text: string; confidence: number; grammar?: string }
  | { type: 'rejected'; text?: string; confidence?: number; grammar?: string }
  | { type: 'hypothesis'; text: string; grammar?: string }
  | { type: 'level'; level: number };
export interface VoiceDiagnosis {
  ok: boolean; error?: string; psVersion?: string; languageMode?: string; os?: string; uiCulture?: string;
  speechLoaded?: boolean; speechError?: string; recognizers?: string[]; micOpen?: boolean; micError?: string;
  micUser?: string; micMachine?: string; micDesktopApps?: string; inputDevices?: string[];
}
export interface ActivityReport { mic: string[]; recorders: string[]; media: string[] }
export interface DriftStatus { window: string; helper: string; message: string }
export interface IntegrationStatus { activity: { supported: boolean; status: string }; drift?: DriftStatus & { supported: boolean }; discord: { status: string } }
export interface MonitorInfo { key: string; id: number; name: string; nickname: string; natural: string; width: number; height: number; scale: number; primary: boolean; internal: boolean; current: boolean; where: '' | 'left' | 'right' | 'above' | 'below'; x: number; y: number }
export type MonitorThen = string; // none, zen, zen-full, zen-off, compact, expand or snap:<layout>
export interface MonitorRule { id: string; enabled: boolean; on: 'connect' | 'disconnect'; monitor: string; moveTo: string; then: MonitorThen; atStart: boolean }
export interface MonitorConfig { names: Record<string, string>; seen: Record<string, { name: string; width: number; height: number }>; onlyOn: string; rules: MonitorRule[] }
export interface MonitorsPayload { list: MonitorInfo[]; config: MonitorConfig; snapLayouts: { id: string; label: string }[] }
export interface Behavior { closeToTray: boolean; startHidden: boolean; alwaysOnTop: boolean; rememberPosition: boolean; glass: boolean; openAtLogin: boolean;
  nativeControls: boolean; appIcon: IconId; mediaKeys: boolean; mediaKeysFollow: boolean; mediaFollowActive: boolean; pauseKey: boolean; pauseKeyCommand: string }
export interface DesktopState {
  compact: boolean; pinned: boolean; maximized: boolean; fullscreen: boolean; visible: boolean;
  globalEnabled: boolean; shortcutResults: ShortcutResult[]; voice: unknown; behavior: Behavior;
  pauseKeyStatus?: 'off' | 'on' | 'error' | 'unsupported'; pauseKeyMessage?: string;
}
export interface DesktopInfo {
  platform: string; version: string; packaged: boolean; installed: boolean; store: boolean; canAutostart: boolean;
  glass: boolean; glassWanted: boolean; glassSupported: boolean; titlebar: 'overlay' | 'custom' | 'inset' | 'none'; titlebarHeight: number;
  exePath: string | null; protocol: string; voiceSupported: boolean; state: DesktopState; noTour?: boolean;
}
export interface ReportState { playing: boolean; mixName: string; timerRunning: boolean; timerLabel: string; phase: 'focus' | 'break' }
export type UpdateStatus = 'idle' | 'unconfigured' | 'checking' | 'uptodate' | 'available' | 'downloading' | 'launching' | 'error';
export interface UpdateState {
  status: UpdateStatus; current: string; latest: string; notes: string; htmlUrl: string; fileName: string; size: number; progress: number;
  error: string; checkedAt: number; dismissed: boolean; repo: string; auto: boolean; configured: boolean; canSelfUpdate: boolean; canUpdate: boolean; disabled: boolean;
}
export interface UpdateBridge {
  get(): Promise<UpdateState | null>;
  check(): Promise<UpdateState | null>;
  install(): Promise<UpdateState | null>;
  skip(): Promise<UpdateState | null>;
  dismiss(): Promise<UpdateState | null>;
  setConfig(config: { repo?: string; auto?: boolean }): Promise<UpdateState | null>;
  onState(callback: (state: UpdateState) => void): () => void;
}
export type FlowKeyEvent = 'down' | 'up' | 'abort' | 'esc' | 'toggle';
export interface FlowKeyStatus { status: 'off' | 'starting' | 'on' | 'error'; message: string; hold: boolean }
export interface NetRequest { url: string; method: 'GET' | 'POST'; headers: Record<string, string>; body?: ArrayBuffer | string }
export interface NetResponse { status: number; headers: Record<string, string>; body: ArrayBuffer }
export interface DesktopBridge {
  getInfo(): Promise<DesktopInfo | null>;
  ready(): void;
  onCommand(callback: (command: { id: string; arg?: string }) => void): () => void;
  onState(callback: (state: DesktopState) => void): () => void;
  onVoice(callback: (event: VoiceEvent) => void): () => void;
  command(command: string): void;
  setBehavior(patch: Partial<Behavior>): Promise<unknown>;
  notify(title: string, body: string): void;
  media(action: 'pause' | 'play' | 'toggle' | 'next' | 'prev' | 'stop' | 'info'): Promise<{ result: { ok: boolean; status: string; app?: string; title?: string; artist?: string; message?: string }; text: string } | null>;
  notifyTest(title: string, body: string): Promise<{ supported: boolean; shown: boolean; error: string; appId: string; shortcut: boolean | null; flashed: boolean } | null>;
  setShortcuts(list: { id: string; label: string; accelerator: string; command: string; always: boolean }[]): Promise<ShortcutResult[]>;
  setTheme(dark: boolean): void;
  report(state: ReportState): void;
  voiceStart(config: unknown): void;
  voiceStop(): void;
  voiceDiagnose(): Promise<VoiceDiagnosis | null>;
  onActivity(callback: (state: ActivityReport) => void): () => void;
  onActivityStatus(callback: (status: { status: string; message: string }) => void): () => void;
  activityConfig(config: { enabled: boolean; recorders: string }): void;
  onDriftSample(callback: (sample: { src: 'window' | 'tab'; app: string; title: string; host: string; at: number; browser?: string }) => void): () => void;
  onDriftStatus(callback: (status: DriftStatus) => void): () => void;
  driftConfig(config: { enabled: boolean; window: boolean; helper: boolean; port: number; token: string }): void;
  driftExtension(): Promise<string | null>;
  driftTest(sample: { src: 'window' | 'tab'; app: string; title: string; host: string; browser?: string }): void;
  discordUpdate(payload: { config: { enabled: boolean; appId: string }; activity: unknown }): void;
  onDiscordStatus(callback: (status: { status: string; detail: string }) => void): () => void;
  integrationStatus(): Promise<IntegrationStatus | null>;
  readSound(slot: string): Promise<{ name: string; bytes: ArrayBuffer } | null>;
  listSounds(): Promise<string[]>;
  openSoundsFolder(): Promise<string>;
  flowConfigure(config: { enabled: boolean; vks: number[]; accelerator: string }): Promise<FlowKeyStatus | null>;
  onFlowKey(callback: (type: FlowKeyEvent) => void): () => void;
  onFlowStatus(callback: (status: FlowKeyStatus) => void): () => void;
  flowUi(ui: unknown): void;
  monitorsGet(): Promise<MonitorsPayload | null>;
  monitorsSet(config: MonitorConfig): Promise<MonitorsPayload | null>;
  monitorsIdentify(): void;
  onMonitors(callback: (payload: MonitorsPayload) => void): () => void;
  puckUpdate(payload: unknown): void;
  puckResetPosition(): void;
  onFlowBar(callback: (action: string) => void): () => void;
  netFetch(request: NetRequest): Promise<NetResponse>;
  relaunch(): void;
  popupMenu(): void;
  update: UpdateBridge;
}

declare global { interface Window { desktop?: DesktopBridge } }

/** Undefined in a normal browser, so the same code runs as the web app and as the desktop app. */
export const desktop: DesktopBridge | undefined = typeof window !== 'undefined' ? window.desktop : undefined;
export const isDesktop = Boolean(desktop);
