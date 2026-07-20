LIVE CHAT + AI ASSISTANT — FINAL COMBINED CHANGES
===================================================
(This is the single, complete zip — includes everything, nothing from
earlier deliveries needs to be applied separately.)

What this adds to your site:
- A floating chat bubble (stacked above your existing WhatsApp button,
  bottom-right, no overlap) with:
    1. Quick-topic buttons for instant scripted answers: sizing & fit,
       fabric & care, delivery time/COD, returns & exchange, order
       tracking. These always work, no dependency on anything external.
    2. A free-text box where a shopper can type ANY question and get a
       real AI-generated reply, powered by NVIDIA's free NIM API — the
       same free API this repo already uses for Admin > Products >
       "Generate with AI" (see SETUP-README.md).
    3. Personalization: for a LOGGED-IN shopper, the server looks up
       their own past orders (product names, order count, last order
       status) via the same auth-scoped Supabase client used on their
       My Account > Orders page — so it can only ever see that one
       customer's own data — and hands a short summary to the AI. This
       lets it naturally reference their taste/past purchases to
       suggest relevant items, which is the conversion-boosting part.
    4. Graceful fallback: if the AI call fails (no API key, free-tier
       rate limit, network issue), the widget shows a plain "having
       trouble" message and offers "Continue on WhatsApp" (your
       existing Admin > Marketing WhatsApp number) so a real team
       member can pick up the conversation. Quick-topic buttons keep
       working regardless.
- No new database table or migration required anywhere in this.

SETUP — one env var (skip if NVIDIA_API_KEY is already in your project):
1. Go to https://build.nvidia.com and sign in (free, no credit card).
2. Generate an API key — starts with nvapi-.
3. Add it to your .env.local (local dev) AND your Vercel/Netlify
   project's Environment Variables (production):
     NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Free tier: ~1,000 credits on signup, 40 requests/minute — plenty for
   a chat widget. A 429 (rate limit) is already handled gracefully.

FILES IN THIS ZIP (paths match your repo root exactly):
1. app/api/chat/ai/route.ts        -> NEW FILE. The AI chat endpoint.
2. components/live-chat-widget.tsx -> NEW FILE. The full widget
                                       (quick topics + AI free-text box).
3. components/providers.tsx        -> MODIFIED. Renders the widget.
   providers.tsx.diff is included too, in case you'd rather apply the
   2-line change (1 import + 1 render line) by hand instead of
   overwriting the whole file.

HOW TO APPLY:
1. Copy app/api/chat/ai/route.ts into your repo at that exact path
   (create the app/api/chat/ai/ folders if they don't exist).
2. Copy components/live-chat-widget.tsx into your repo's components/.
3. Replace your repo's components/providers.tsx with the one in this
   zip (or apply providers.tsx.diff by hand).
4. Add NVIDIA_API_KEY to your env as described above.
5. git add -A
   git commit -m "Add live AI chat widget with order-history personalization"
   git push

That's it — no other files are touched.
