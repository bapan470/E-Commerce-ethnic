LIVE CHAT + AI ASSISTANT — FINAL COMBINED CHANGES (v2)
=========================================================
Single, complete zip. Nothing from earlier deliveries needs applying
separately — this replaces all of it.

WHAT'S IN THIS VERSION (fixes from your feedback):
1. Fixed the page zoom/jump when typing in the chat's text box on
   mobile (iOS/Android auto-zoom on inputs with font-size under 16px —
   the input now uses 16px on mobile).
2. The WhatsApp button now also has a permanent spot INSIDE the chat
   popup — a pinned green bar right under the header, always visible
   (not buried in the scroll like before).
3. Both WhatsApp entry points — the floating button AND the one inside
   the chat popup — read from the exact same Admin > Marketing >
   WhatsApp toggle/number you already have. Flip it on/off once in
   Admin and both places update together; nothing to configure twice.
4. AI replies: switched to a stronger conversational model
   (meta/llama-3.3-70b-instruct) as the primary model, with automatic
   fallback to the vision-instruct model this project already uses
   successfully for "Generate with AI" if the primary one isn't
   available on your account — so one bad model call doesn't just fail
   silently. Error messages in the chat now also say WHY it failed
   (not configured / rate-limited / key rejected / other) so you can
   tell at a glance what to fix, instead of just "could not reach".
5. The AI can now see and tell shoppers their actual order ID, current
   status, and tracking number/courier (for logged-in customers, pulled
   securely from their own orders only) — so "where's my order" gets a
   real answer with their real order number, not a generic one.

FULL FEATURE SUMMARY:
- Floating chat bubble (stacked above your WhatsApp button, no overlap)
  with:
    - Quick-topic buttons: sizing & fit, fabric & care, delivery/COD,
      returns & exchange, order tracking — instant, scripted, always
      work with zero external dependency.
    - A free-text box for any question, answered live by AI.
    - A pinned WhatsApp bar for anyone who'd rather talk to a human,
      any time, not just as a fallback.
- Personalization: logged-in shoppers' order history (product names,
  order IDs, status, tracking) is passed to the AI so it can answer
  order questions directly and suggest relevant items based on what
  they've actually bought.
- Graceful degradation: AI down for any reason → clear reason shown in
  chat + WhatsApp bar right there to hand off to a real person. Quick
  topics keep working regardless.
- No new database table or migration anywhere in this feature.

SETUP — one env var (skip if NVIDIA_API_KEY is already in your project):
1. https://build.nvidia.com → sign in free (no card).
2. Generate an API key (starts with nvapi-).
3. Add to .env.local (local) AND Vercel/Netlify project env vars:
     NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Free tier: ~1,000 credits on signup, 40 requests/minute.

IF THE AI STILL SAYS "having trouble" AFTER DEPLOYING:
Open your browser's dev tools → Network tab → send a chat message →
click the /api/chat/ai request → check the response body's "error"
field, and check your hosting provider's function logs (Vercel:
Deployments > Functions; Netlify: Functions tab) for a line starting
with "[chat/ai]" — it will show the exact NIM API status code and
error text so you (or I) can pinpoint the exact cause (wrong/expired
key, model not enabled on your account, etc.) instead of guessing.

FILES IN THIS ZIP (paths match your repo root exactly):
1. app/api/chat/ai/route.ts        -> NEW/REPLACED FILE. The AI endpoint.
2. components/live-chat-widget.tsx -> NEW/REPLACED FILE. Full widget.
3. components/providers.tsx        -> MODIFIED. Renders the widget.
   providers.tsx.diff included in case you'd rather apply the 2-line
   change (1 import + 1 render line) by hand instead of overwriting.

HOW TO APPLY:
1. Copy app/api/chat/ai/route.ts into your repo at that exact path
   (create the app/api/chat/ai/ folders if they don't exist).
2. Copy components/live-chat-widget.tsx into your repo's components/,
   overwriting the old one if present.
3. Replace your repo's components/providers.tsx with the one here
   (or apply providers.tsx.diff by hand if you already applied it).
4. Make sure NVIDIA_API_KEY is set in your env (see Setup above).
5. git add -A
   git commit -m "Live chat: fix mobile zoom, pinned WhatsApp, better AI model + order lookup"
   git push
