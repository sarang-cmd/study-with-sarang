import { isDesktop } from '../../lib/desktop';
import { LOUDNESS_BOOST, setPrefs, usePrefs, type Loudness } from '../../lib/prefs';
import { Slider } from '../Slider';
import { Card, Toggle } from '../desktop/shared';
import { Row, Segmented } from './parts';
import { RecordingsCard } from './RecordingsCard';

const LOUDNESS: { id: Loudness; label: string; hint: string }[] = [
  { id: 'gentle', label: 'Gentle', hint: 'The top of the volume slider is about as loud as a normal player. Best for quiet rooms and headphones.' },
  { id: 'balanced', label: 'Balanced', hint: 'A little more at the top of the slider.' },
  { id: 'loud', label: 'Loud', hint: 'Default. 100% is about 8 dB over a normal player, for speakers and noisy rooms.' },
  { id: 'max', label: 'Maximum', hint: 'The most the app can do. A soft limiter still keeps it from distorting, but be careful with headphones.' },
];

export function SoundTab() {
  const [prefs] = usePrefs();
  const hint = LOUDNESS.find((item) => item.id === prefs.loudness)?.hint ?? '';
  return <div className="grid gap-5">
    <RecordingsCard />
    <Card title="Loudness" hint="Changes how the volume slider maps to real loudness. Quiet settings stay the same; only the top of the slider moves.">
      <Row label="Loudness range" hint={hint}>
        <Segmented<Loudness> label="Loudness range" value={prefs.loudness} onChange={(loudness) => setPrefs({ loudness })} options={LOUDNESS.map((item) => ({ id: item.id, label: item.label }))} />
      </Row>
      <div className="mt-2 grid gap-2">
        <Slider label="Volume cap" value={prefs.volumeCap} min={20} max={100} defaultValue={100} onChange={(volumeCap) => setPrefs({ volumeCap })} format={(value) => `${value}%`} hint="The slider can never go louder than this share of the range. A safety limit for late night or headphones." />
        <p className="px-1 text-[10px] text-muted">Boost factor at full volume: {(1 + LOUDNESS_BOOST[prefs.loudness]).toFixed(1)}x, cap {prefs.volumeCap}%.</p>
      </div>
    </Card>
    <Card title="Fades" hint="How softly the sound starts and stops when you press play or pause.">
      <div className="grid gap-2">
        <Slider label="Fade in" value={prefs.fadeIn} min={0.05} max={10} step={0.05} defaultValue={0.25} onChange={(fadeIn) => setPrefs({ fadeIn })} format={(value) => `${value.toFixed(2)} s`} />
        <Slider label="Fade out" value={prefs.fadeOut} min={0.05} max={10} step={0.05} defaultValue={0.2} onChange={(fadeOut) => setPrefs({ fadeOut })} format={(value) => `${value.toFixed(2)} s`} />
      </div>
    </Card>
    <Card title="Starting up">
      <div className="grid gap-2">
        <Toggle label="Start playing when the app opens" hint={isDesktop ? 'Plays your last mix right away. Open at login and Start hidden (Window and updates) make it a background sound.' : 'Browsers usually block sound until you click, so this may not start on its own here. The desktop app always can.'} checked={prefs.startPlaying} onChange={(startPlaying) => setPrefs({ startPlaying })} />
      </div>
    </Card>
    <Card title="Media controls" hint="The Windows media flyout, lock screen and keyboards with media displays.">
      <div className="grid gap-2">
        <Toggle label="Show the app icon in media controls" hint="Without it, some flyouts show only a play button while paused. Turn off if you prefer a plain title." checked={prefs.mediaArtwork} onChange={(mediaArtwork) => setPrefs({ mediaArtwork })} />
        <Row label="Seek bar" hint="The progress line in the Windows media flyout and on lock screens."><Segmented<'remaining' | 'elapsed' | 'off'> label="Seek bar" value={prefs.mediaSeek} onChange={(mediaSeek) => setPrefs({ mediaSeek })} options={[{ id: 'remaining', label: 'Time left' }, { id: 'elapsed', label: 'Time passed' }, { id: 'off', label: 'Hidden' }]} /></Row>
        <Row label="Title" hint="For example: Focus, Rain and Thunder."><Segmented<'phase' | 'mix' | 'both'> label="Media title" value={prefs.mediaTitle} onChange={(mediaTitle) => setPrefs({ mediaTitle })} options={[{ id: 'both', label: 'Block and mix' }, { id: 'phase', label: 'Block' }, { id: 'mix', label: 'Mix' }]} /></Row>
      </div>
    </Card>
    {!isDesktop && <p className="rounded-xl border border-line bg-canvas p-4 text-[11px] leading-relaxed text-muted">Pausing automatically when you record or watch a video, and Discord status, are in the desktop app. A web page cannot see what other programs are doing, so it cannot offer them.</p>}
  </div>;
}
