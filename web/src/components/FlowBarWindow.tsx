import { useEffect, useState } from 'react';
import { idleUi, type FlowUi } from '../lib/flow';
import { FlowBarView } from './FlowBarView';

declare global { interface Window { flowbar?: { onUi(cb: (ui: FlowUi) => void): () => void; action(name: string): void } } }

/** The page loaded inside the small always-on-top Flow window (desktop only). It only draws what the main window sends. */
export default function FlowBarWindow() {
  const [ui, setUi] = useState<FlowUi>(idleUi());
  useEffect(() => {
    document.documentElement.classList.add('flowbar');
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return window.flowbar?.onUi(setUi);
  }, []);
  return <div className="fixed inset-0"><FlowBarView ui={ui} onAction={(action) => window.flowbar?.action(action)} /></div>;
}
