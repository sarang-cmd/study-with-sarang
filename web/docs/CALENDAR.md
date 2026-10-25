# Your study sessions in your calendar (optional, one-time setup)

Settings, Calendar gives each signed-in person a **private calendar link**. Subscribe to it once in Google Calendar, Apple Calendar or Outlook and every saved study session shows up as an event, updated after each session. The link is random, one per account, and can be replaced at any time with "New link" (the old link stops working).

## Set it up (about 5 minutes, once, by the person who runs the Supabase project)

1. In Supabase, open **SQL editor**, paste `supabase/calendar.sql` and run it. It creates `calendar_feeds` (one row per user: the secret token and the calendar text) with Row Level Security.
2. Deploy the function that serves the link. Calendar apps cannot send headers, so a function hands out the text for one exact token:

   ```
   supabase functions deploy calendar-feed --no-verify-jwt
   ```

3. In the app, sign in (Settings, Cloud sync), open Settings, Calendar and switch on **Keep my private calendar link up to date**. Copy the link.

## Subscribe

- **Google Calendar:** Other calendars, plus, From URL, paste the link. (Google refreshes subscribed calendars every few hours, sometimes up to a day; that is Google's schedule.)
- **Apple Calendar:** File, New Calendar Subscription. **Outlook:** Add calendar, Subscribe from web.

## What each event contains (all optional)

Title, your goal for the block, the task name, distractions and sound, your exam date, and whether it shows as busy or free. Nothing else leaves the app. Anyone who has the link can read the calendar, so treat it like a password and use Reset link if it leaks.

## Without Supabase

Settings, Calendar can also download an `.ics` file of your sessions that you import by hand. It will not update by itself.
