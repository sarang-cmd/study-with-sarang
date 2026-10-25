# Using your own backend (optional, for the future)

Everything works with no backend at all. Three optional pieces can use a server, and each can point at **your own** Supabase project or web space instead of the built-in one. Nothing here needs a code change: it is configuration, so the same app can later move to your own infrastructure.

| Piece | What it does | Where it is configured | Setup guide |
| ----- | ------------ | ---------------------- | ----------- |
| Cloud sync | Syncs mixes, time log and settings between devices | Settings > Cloud sync > Advanced (or "Set up your own Supabase project") | `docs/SUPABASE.md`, `supabase/schema.sql` |
| Flow Cloud | A shared key-less dictation helper for Flow (5 requests a day each, speech to text only) | Settings, Flow voice and AI, Flow Cloud, Different address. By default it is `<Supabase project>/functions/v1/flow-assist`, so it follows the sync project. | `docs/FLOW_CLOUD.md`, `supabase/flow_cloud.sql`, `supabase/functions/flow-assist` |
| Sound recordings | Hosts the ten recordings so the app stays small | Settings > Sound > Real recordings > Cloud address | `docs/SOUNDS.md` |

## What a build can preset

`src/lib/cloudDefaults.ts` holds the public Supabase URL and publishable key (also settable with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time). Flow Cloud and the sound base address are derived from them, so one project is enough for all three. Never put a secret or service-role key into the app; the Groq key lives only as a secret of the edge function.

## A suggested plan

1. **Now:** nothing. Own Groq keys work for Flow, bundled or local files work for sounds, sync uses the built-in project.
2. **When you want key-less Flow:** run `supabase/flow_cloud.sql`, set `GROQ_API_KEY`, deploy `flow-assist` with `--no-verify-jwt`, set the secrets for limits. Watch your Groq usage; the global ceiling (`FLOW_GLOBAL_DAILY`) bounds the cost.
3. **When the app grows:** move sounds to a public Storage bucket, point the cloud address at it, and ship a smaller installer.
4. **Moving everything to a new project:** create it, run the three SQL files (`schema.sql`, `flow_cloud.sql`), deploy the function, upload the sounds, change `cloudDefaults.ts` (or the build variables), rebuild. People who set their own project in Settings are unaffected.

## Privacy notes to include if you publish

- Sync stores what the person syncs, under their account, protected by Row Level Security.
- Flow Cloud receives audio or text only when Flow was unsure and the person allowed it, forwards it to Groq, and stores only counters (random device id, hashed network address, count per day).
- Sound downloads from your bucket reveal an IP address to your host, like any file download.
