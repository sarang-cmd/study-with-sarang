import { Clapperboard } from 'lucide-react';
import { Slider } from '../Slider';
import { Card, Toggle } from '../desktop/shared';
import { Row, Segmented } from './parts';
import { currentScene, setRoom, useRoom, useScenes, type RoomClock, type RoomFollow, type RoomNext } from '../../lib/studyRoom';

/** Every option of the study room. The Zen drawer shows the short list; this is the full one. */
export function StudyRoomOptions() {
  const room = useRoom(); const scenes = useScenes();
  const current = currentScene(scenes, room);
  return <div className="grid gap-2">
    <Toggle label="Show the study room in Zen" hint={scenes.length ? 'Your video plays behind the clock.' : 'Add a video in the Library first.'} checked={room.on} onChange={(on) => setRoom({ on })} />
    <Row label="Scene" hint="The video to play. Manage the list on the Library page."><select className="field !min-h-8 !w-auto max-w-[220px] !py-1 text-[11px]" aria-label="Scene" value={current?.id ?? ''} disabled={!scenes.length} onChange={(e) => setRoom({ sceneId: e.target.value })}>
      {!scenes.length && <option value="">No scenes yet</option>}{scenes.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></Row>
    <Row label="The sound" hint="Replace: your soundscape pauses while the video plays, and returns afterwards. Together: both play."><Segmented label="Sound with the video" value={room.sound} onChange={(sound) => setRoom({ sound })} options={[{ id: 'replace', label: 'Replace' }, { id: 'mix', label: 'Together' }]} /></Row>
    <Slider label="Video volume" value={room.volume} min={0} max={100} step={5} defaultValue={60} onChange={(volume) => setRoom({ volume })} format={(v) => `${v}%`} />
    <Slider label="Darken the video" value={room.dim} min={0} max={80} step={5} defaultValue={35} onChange={(dim) => setRoom({ dim })} format={(v) => `${v}%`} />
    <Slider label="Blur" value={room.blur} min={0} max={24} step={1} defaultValue={0} onChange={(blur) => setRoom({ blur })} format={(v) => (v ? `${v} px` : 'off')} />
    <Row label="Picture" hint="Fill: crop to cover the screen. Fit: show the whole picture."><Segmented label="Picture fit" value={room.fit} onChange={(fit) => setRoom({ fit })} options={[{ id: 'cover', label: 'Fill' }, { id: 'contain', label: 'Fit' }]} /></Row>
    <Row label="Clock over the video"><Segmented<RoomClock> label="Clock size" value={room.clock} onChange={(clock) => setRoom({ clock })} options={[{ id: 'big', label: 'Big' }, { id: 'small', label: 'Small' }, { id: 'hidden', label: 'Hidden' }]} /></Row>
    <Row label="When it plays" hint="Free: you press play. With the timer: it plays only while the timer runs. Focus blocks only: it also stops during breaks."><Segmented<RoomFollow> label="Follow the timer" value={room.follow} onChange={(follow) => setRoom({ follow })} options={[{ id: 'free', label: 'Free' }, { id: 'timer', label: 'With timer' }, { id: 'focus', label: 'Focus only' }]} /></Row>
    <Row label="When a scene ends"><Segmented<RoomNext> label="After a scene" value={room.next} onChange={(next) => setRoom({ next })} options={[{ id: 'loop-one', label: 'Repeat' }, { id: 'loop-all', label: 'Next' }, { id: 'shuffle', label: 'Shuffle' }, { id: 'stop', label: 'Stop' }]} /></Row>
    <Toggle label="Start when Zen opens" checked={room.autoPlay} onChange={(autoPlay) => setRoom({ autoPlay })} />
    <Toggle label="Show the scene name" checked={room.showTitle} onChange={(showTitle) => setRoom({ showTitle })} />
  </div>;
}

export function StudyRoomTab() {
  return <div className="grid gap-5">
    <Card title="Study room" hint="Your own study-with-me style video behind the Zen clock, in place of the sound or together with it. Videos you add stay on this device; nothing is uploaded and this list is not synced.">
      <StudyRoomOptions />
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted"><Clapperboard size={12} /> Add or remove videos on the Library page. YouTube videos only play if their owner allows embedding.</p>
    </Card>
  </div>;
}
