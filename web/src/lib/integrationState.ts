import { useSyncExternalStore } from 'react';
import { emptyActivity, type ActivityState } from './autoPause';

/** Live facts about the optional desktop integrations, for the settings pages. Written by IntegrationsBridge. */
export interface IntegrationState {
  activity: ActivityState;                 // What the helper currently sees
  activityStatus: string;                  // off | on | error | unsupported
  activityMessage: string;
  holding: 'none' | 'paused' | 'lowered';  // What auto-pause is doing right now
  holdReason: string;
  discordStatus: string;                   // off | connecting | waiting | connected | error
  discordDetail: string;
  driftWindow: string;                     // off | on | error | unsupported
  driftHelper: string;                     // off | listening | connected | error
  driftMessage: string;
  driftNow: { label: string; verdict: string; why: string; seconds: number } | null; // What drift detection sees right now
}
const initial = (): IntegrationState => ({ activity: emptyActivity, activityStatus: 'off', activityMessage: '', holding: 'none', holdReason: '', discordStatus: 'off', discordDetail: '', driftWindow: 'off', driftHelper: 'off', driftMessage: '', driftNow: null });
let current = initial();
const listeners = new Set<() => void>();
export const getIntegrationState = () => current;
export function patchIntegrationState(patch: Partial<IntegrationState>) { current = { ...current, ...patch }; listeners.forEach((listener) => listener()); }
export function useIntegrationState(): IntegrationState {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getIntegrationState, getIntegrationState);
}
