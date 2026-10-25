import { EyeOff, PictureInPicture2, RefreshCw } from 'lucide-react';
import { useDesktop } from '../../context/DesktopContext';
import { desktop } from '../../lib/desktop';
import { Card, Toggle } from './shared';

export function WindowCard() {
  const { info, state, run } = useDesktop();
  if (!info || !state) return null;
  const behavior = state.behavior;
  const set = (patch: Parameters<NonNullable<typeof desktop>['setBehavior']>[0]) => { void desktop?.setBehavior(patch); };
  const glassChanged = info.glassSupported && behavior.glass !== info.glass;
  return <Card title="Window and startup" hint="Park it on one monitor and it stays there. Closing the window hides it to the tray, so sound and the timer keep going.">
    <div className="grid gap-2">
      <Toggle label="Open when I sign in to the computer" hint={info.canAutostart ? 'Starts with your session.' : 'Available once the app is installed with the setup.'} checked={behavior.openAtLogin} disabled={!info.canAutostart} onChange={(value) => set({ openAtLogin: value })} />
      <Toggle label="Start hidden in the tray" hint="When it opens at sign-in, stay out of the way until you call it." checked={behavior.startHidden} onChange={(value) => set({ startHidden: value })} />
      <Toggle label="Close button hides to the tray" hint="Turn off to make the close button quit the app." checked={behavior.closeToTray} onChange={(value) => set({ closeToTray: value })} />
      <Toggle label="Always on top" hint="Keep the window above other apps." checked={behavior.alwaysOnTop} onChange={(value) => set({ alwaysOnTop: value })} />
      <Toggle label="Remember window position and monitor" checked={behavior.rememberPosition} onChange={(value) => set({ rememberPosition: value })} />
      {info.glassSupported && <Toggle label={info.platform === 'darwin' ? 'Translucent glass material' : 'Mica material (Windows 11)'} hint="Lets your wallpaper tint the window. Restart to apply a change." checked={behavior.glass} onChange={(value) => set({ glass: value })} />}
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" className="studio-button" onClick={() => run('window.compact')}><PictureInPicture2 size={13} />Collapse to mini bar</button>
      <button type="button" className="studio-button" onClick={() => run('window.hide')}><EyeOff size={13} />Hide to tray</button>
      {glassChanged && <button type="button" className="studio-button" onClick={() => desktop?.relaunch()}><RefreshCw size={13} />Restart to apply</button>}
    </div>
    <p className="mt-3 text-[10px] leading-relaxed text-muted">Version {info.version}{info.installed ? ' (installed)' : info.store ? ' (Microsoft Store)' : info.packaged ? ' (running without installing)' : ' (development)'}.</p>
  </Card>;
}
