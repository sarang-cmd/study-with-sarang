import { useMemo, useState } from 'react';
import {
  type LucideIcon, Anchor, Award, AudioWaveform, Brain, CalendarCheck, Castle, Compass, Crown, Feather, Flame, Flower2, Gem, Headphones, Hourglass, Infinity as InfinityIcon,
  Layers, Lock, Medal, BookOpen, GraduationCap, ListChecks, Crosshair, Sun, Clock, Flag, Dumbbell, KeyRound, Star, Library, Puzzle, TrendingUp, Eye, Ghost, Diamond, Mountain, MoonStar, Orbit, PartyPopper, Rocket, ShieldCheck, SlidersHorizontal, Sparkles, Sunrise, Tags, Target, Telescope, Trophy, WandSparkles, Zap,
} from 'lucide-react';
import { useAchievementResults } from '../hooks/useAchievements';
import { ACHIEVEMENTS, CATEGORY_LABELS, type AchievementCategory, type AchievementResult, type IconKey } from '../lib/achievements';
import { usePrefs } from '../lib/prefs';

type Glyph = LucideIcon;
const ICONS: Record<IconKey, Glyph> = {
  sparkles: Sparkles, hourglass: Hourglass, brain: Brain, mountain: Mountain, shield: ShieldCheck, crown: Crown, gem: Gem, flame: Flame, zap: Zap,
  calendar: CalendarCheck, anchor: Anchor, infinity: InfinityIcon, layers: Layers, castle: Castle, trophy: Trophy, telescope: Telescope, rocket: Rocket,
  orbit: Orbit, feather: Feather, flower: Flower2, sunrise: Sunrise, moon: MoonStar, party: PartyPopper, target: Target, medal: Medal, headphones: Headphones,
  waveform: AudioWaveform, sliders: SlidersHorizontal, wand: WandSparkles, compass: Compass, tags: Tags, award: Award,
  book: BookOpen, graduation: GraduationCap, checks: ListChecks, crosshair: Crosshair, sun: Sun, clock: Clock, flag: Flag, dumbbell: Dumbbell, key: KeyRound, star: Star, library: Library, puzzle: Puzzle, trend: TrendingUp, eye: Eye, ghost: Ghost, diamond: Diamond,
};
const TIER_NAMES = ['', 'Bronze', 'Silver', 'Gold', 'Platinum'];
const HEX = 'M32 3 L57 17.5 L57 46.5 L32 61 L7 46.5 L7 17.5 Z';
const HEX_INNER = 'M32 9 L52 20.5 L52 43.5 L32 55 L12 43.5 L12 20.5 Z';

/** A hexagon badge. The outline fills as you get closer; unlocked badges are solid. Higher tiers get extra rings. */
export function Badge({ icon, tier, progress, unlocked, size = 64 }: { icon: IconKey; tier: 1 | 2 | 3 | 4; progress: number; unlocked: boolean; size?: number }) {
  const Icon = ICONS[icon];
  return <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
    <svg viewBox="0 0 64 64" width={size} height={size} className={unlocked ? 'text-ink' : 'text-muted'}>
      <path d={HEX} pathLength={100} fill={unlocked ? 'currentColor' : 'none'} stroke="currentColor" strokeOpacity={unlocked ? 1 : .22} strokeWidth={2.4} strokeLinejoin="round" />
      {!unlocked && progress > 0 && <path d={HEX} pathLength={100} fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${Math.max(2, progress * 100)} 100`} />}
      {tier >= 3 && <path d={HEX_INNER} pathLength={100} fill="none" stroke={unlocked ? 'rgb(var(--canvas))' : 'currentColor'} strokeOpacity={unlocked ? .45 : .2} strokeWidth={1} strokeLinejoin="round" />}
      {tier >= 4 && <g stroke={unlocked ? 'rgb(var(--canvas))' : 'currentColor'} strokeOpacity={unlocked ? .7 : .25} strokeWidth={1.4} strokeLinecap="round"><path d="M32 12v3M20 22l2.2 1.4M44 22l-2.2 1.4" /></g>}
    </svg>
    <span className={`absolute inset-0 flex items-center justify-center ${unlocked ? 'text-canvas' : 'text-muted'}`}>
      {unlocked || progress > 0 ? <Icon size={Math.round(size * .4)} strokeWidth={1.8} /> : <Lock size={Math.round(size * .3)} strokeWidth={1.8} className="opacity-60" />}
    </span>
  </div>;
}

const pips = (tier: number, on: boolean) => <span className="flex gap-0.5" aria-label={`${TIER_NAMES[tier]} tier`}>
  {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= tier ? (on ? 'bg-ink' : 'bg-muted/60') : 'bg-line'}`} />)}
</span>;

function amount(result: AchievementResult) {
  const { def, value } = result;
  const shown = def.unit === 'h' ? (value < 10 ? value.toFixed(1) : Math.floor(value).toString()) : Math.floor(value).toString();
  return `${shown} / ${def.target} ${def.unit}`;
}
const dateLabel = (iso?: string) => { if (!iso) return ''; try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };

type Filter = 'all' | AchievementCategory | 'locked' | 'unlocked' | 'secret';
type Sort = 'default' | 'closest' | 'newest' | 'tier';

export function Achievements({ embedded = false }: { embedded?: boolean }) {
  const [prefs] = usePrefs();
  const { results, store } = useAchievementResults();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('default');
  const unlocked = results.filter((item) => item.unlocked);
  const latest = useMemo(() => unlocked.filter((item) => store.unlocked[item.def.id]).sort((x, y) => (store.unlocked[y.def.id] ?? '').localeCompare(store.unlocked[x.def.id] ?? ''))[0], [unlocked, store]);
  const nextUp = useMemo(() => results.filter((item) => !item.unlocked && !item.def.secret && item.progress > 0).sort((x, y) => y.progress - x.progress).slice(0, 3), [results]);
  const shown = useMemo(() => {
    const base = results.filter((item) => filter === 'all' ? true : filter === 'locked' ? !item.unlocked : filter === 'unlocked' ? item.unlocked : filter === 'secret' ? item.def.secret : item.def.category === filter);
    const copy = [...base];
    if (sort === 'closest') copy.sort((x, y) => Number(x.unlocked) - Number(y.unlocked) || y.progress - x.progress);
    else if (sort === 'newest') copy.sort((x, y) => (store.unlocked[y.def.id] ?? '').localeCompare(store.unlocked[x.def.id] ?? ''));
    else if (sort === 'tier') copy.sort((x, y) => y.def.tier - x.def.tier);
    return copy;
  }, [results, filter, sort, store]);
  if (!prefs.achievements) return null;
  const pct = Math.round((unlocked.length / ACHIEVEMENTS.length) * 100);
  const secretTotal = ACHIEVEMENTS.filter((d) => d.secret).length; const secretFound = unlocked.filter((item) => item.def.secret).length;
  const tierCounts = [1, 2, 3, 4].map((tier) => ({ tier, have: unlocked.filter((i) => i.def.tier === tier).length, all: ACHIEVEMENTS.filter((d) => d.tier === tier).length }));
  const chips: [Filter, string][] = [['all', 'All'], ['unlocked', 'Unlocked'], ['locked', 'Locked'], ...(Object.keys(CATEGORY_LABELS) as AchievementCategory[]).map((id): [Filter, string] => [id, CATEGORY_LABELS[id]]), ['secret', `Secret ${secretFound}/${secretTotal}`]];

  return <section id="achievements" aria-labelledby="achievements-heading" data-testid="achievements" className={embedded ? '' : 'mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7'}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="section-label mb-2">Achievements</p>
        <h2 id="achievements-heading" className="text-[22px] font-semibold leading-tight tracking-tight">{unlocked.length} of {ACHIEVEMENTS.length} unlocked</h2>
        <p className="mt-1 text-[12px] text-muted">{latest ? <>Latest: <strong className="text-ink">{latest.def.title}</strong> on {dateLabel(store.unlocked[latest.def.id])}.</> : 'Focus, plan and listen to earn them. Nothing here can be gained by pressing buttons, and the later ones take weeks.'}</p>
      </div>
      <div className="w-full max-w-[260px]" role="progressbar" aria-label="Achievements unlocked" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="flex justify-between font-mono text-[10px] text-muted"><span>Overall</span><span>{pct}%</span></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-ink transition-[width] duration-700" style={{ width: `${pct}%` }} /></div>
        <div className="mt-2 flex justify-between font-mono text-[9px] text-muted">{tierCounts.map((t) => <span key={t.tier} title={`${TIER_NAMES[t.tier]}: ${t.have} of ${t.all}`}>{TIER_NAMES[t.tier].slice(0, 3)} {t.have}/{t.all}</span>)}</div>
      </div>
    </div>
    {nextUp.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Closest to unlocking" data-testid="next-up">
      {nextUp.map((item) => <div key={item.def.id} className="rounded-xl border border-line bg-canvas px-3.5 py-2.5">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[.14em] text-muted">Next up</p>
        <p className="mt-0.5 truncate text-[12px] font-semibold">{item.def.title}</p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-ink transition-[width] duration-700" style={{ width: `${Math.round(item.progress * 100)}%` }} /></div>
        <p className="mt-1 font-mono text-[9px] text-muted">{amount(item)}</p>
      </div>)}
    </div>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <div role="tablist" aria-label="Achievement groups" className="flex flex-wrap gap-1.5">
        {chips.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${filter === id ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>{label}</button>)}
      </div>
      <label className="flex items-center gap-1.5 text-[10px] text-muted">Sort <select className="field !min-h-7 !w-auto !py-0.5 text-[11px]" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort achievements"><option value="default">Group order</option><option value="closest">Closest first</option><option value="newest">Newest first</option><option value="tier">Hardest first</option></select></label>
    </div>
    <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((item) => { const hidden = item.def.secret && !item.unlocked; return <li key={item.def.id} data-unlocked={item.unlocked} data-secret={hidden || undefined} data-testid="achievement"
        className={`group flex items-center gap-3.5 rounded-xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 ${item.unlocked ? 'border-ink/30 bg-canvas hover:border-ink' : 'border-line bg-canvas/60'}`}>
        <Badge icon={hidden ? 'key' : item.def.icon} tier={item.def.tier} progress={hidden ? 0 : item.progress} unlocked={item.unlocked} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><h3 className={`truncate text-[13px] font-semibold ${item.unlocked ? '' : 'text-muted'}`}>{hidden ? 'Secret achievement' : item.def.title}</h3>{pips(item.def.tier, item.unlocked)}</div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">{hidden ? 'Keep studying and you may stumble on it.' : item.def.text}</p>
          <p className="mt-1.5 font-mono text-[10px] text-muted">{item.unlocked ? `Unlocked ${dateLabel(store.unlocked[item.def.id])}` : hidden ? 'Hidden' : amount(item)}</p>
        </div>
      </li>; })}
      {!shown.length && <li className="col-span-full py-6 text-center text-[12px] text-muted">Nothing in this group yet.</li>}
    </ul>
  </section>;
}
