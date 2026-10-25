# Flow Cloud: the free shared dictation helper (optional, one-time setup)

Flow understands clear commands on your computer, for free. **Flow Cloud** is a small Supabase function that turns speech into text (Whisper on Groq) for people who have no AI key. **It covers dictation only.** Chat, the assistant, drift checks and every other AI feature use each person's own key (see the AI chapter of the master guide). The free allowance is **5 requests a day per device** (20 per network address) so the shared Groq key cannot run up a bill.

You do not need it. If you skip it, the "Flow Cloud" choice says it is not set up, and own keys work as usual.

## Set it up (about 10 minutes)

1. Create a free Groq key at https://console.groq.com/keys. It never goes into the app or the repository.
2. In Supabase, open **SQL editor**, paste `supabase/flow_cloud.sql` and run it. It creates a private counter table and an atomic function.
3. Install the Supabase CLI, log in, link your project, then deploy. The app sends the publishable key, which is not a JWT, so JWT verification must be off. The counters, not the JWT, protect the function:

   ```
   supabase secrets set GROQ_API_KEY=gsk_your_key_here
   supabase functions deploy flow-assist --no-verify-jwt
   ```

4. Done. The app finds it at `<your project url>/functions/v1/flow-assist`. To use another project, paste its address in **Settings, Flow voice and AI, Flow Cloud, Different address**.

## Limits (all optional secrets, with defaults)

| Secret | Default | Meaning |
| --- | --- | --- |
| `FLOW_PER_DEVICE` | 5 | Dictation requests per device per day (UTC). |
| `FLOW_PER_IP` | 20 | Per network address, so reinstalling does not reset the allowance. Addresses are salted and hashed. |
| `FLOW_GLOBAL_DAILY` | 500 | A ceiling for the whole service, so the bill and your Groq quota are bounded whatever happens. |
| `FLOW_SALT` | `flow` | Any random text. Used when hashing addresses. |
| `FLOW_STT_MODEL` | `whisper-large-v3-turbo` | Change when Groq renames the model. |

The function answers `403` to `?action=chat`: chat is deliberately not offered. The app also keeps its own count, only to show it to the person; the server is the real limit.

## Privacy

Audio is sent to the function only when Flow was unsure about a command (or you chose "Use the service"). The function forwards it to Groq and keeps nothing: only counters are stored, with a random device id and a hashed network address. Say so in your privacy text if you publish the app.

## Check it

```
curl -i -X POST "https://YOUR-PROJECT.supabase.co/functions/v1/flow-assist?action=chat" \
  -H "content-type: application/json" -H "x-flow-device: 0123456789abcdef0123" -d '{}'
```

A `403` with "speech to text only" means the policy works. To test dictation, send a short audio file with `?action=transcribe` and `--data-binary @clip.webm` (a `200` with `text` means it works; `429` means the counters are doing their job; `503` means `GROQ_API_KEY` is missing).
