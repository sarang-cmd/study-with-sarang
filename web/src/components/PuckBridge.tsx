import { useEffect } from 'react';
import { desktop } from '../lib/desktop';
import { usePuck } from '../lib/puck';
import { usePuckState } from '../hooks/usePuckState';
import { useTheme } from '../hooks/useTheme';

/** Desktop only: tells the floating puck window what to show, once a second while the timer runs. */
export function PuckBridge() {
  const settings = usePuck(); const state = usePuckState(); const theme = useTheme();
  useEffect(() => {
    desktop?.puckUpdate({ state, settings, dark: theme.dark, active: state.soundPlaying || state.timerRunning });
  }, [state, settings, theme.dark]);
  return null;
}
