AI CHATBOT FIX — replace these 2 files in your repo, then commit & push
=========================================================================

Files in this zip (same folder structure as your repo root):
  app/api/chat/ai/route.ts
  lib/settings-api.ts

WHAT WAS WRONG
--------------
1. lib/settings-api.ts had a DEFAULT_AI_CHAT_SETTINGS constant still
   pointing at "meta/llama-3.3-70b-instruct" — a model NVIDIA retired
   on 2026-08-26 (HTTP 410 Gone). Your route.ts defaults were already
   fixed for this on 2026-09-02, but this second constant was missed.
   Since your store has no custom value saved in Admin > Settings >
   AI Chat Assistant, every chat request was still hitting the dead
   model first.
2. Added 2 extra safety-net models (Mistral, Gemma) so the widget
   survives even if NVIDIA retires the whole Llama family again.
3. The settings lookup in route.ts wasn't wrapped in try/catch, so if
   it ever threw, the API returned an HTML error page instead of JSON
   -- which the widget silently turns into the same generic
   "having trouble" message. Now wrapped with a safe fallback.

HOW TO APPLY
------------
Option A (simplest): just copy these 2 files into your repo, overwriting
the existing ones at the same paths, then:
    git add app/api/chat/ai/route.ts lib/settings-api.ts
    git commit -m "fix: AI chat widget still using retired NVIDIA model"
    git push

Option B: apply CHANGES.diff instead:
    git apply CHANGES.diff

AFTER DEPLOYING
---------------
Test the chat widget on the live site. If it STILL shows the generic
error, the cause is something I can't see from a code-only clone --
most likely one of:
  - NVIDIA_API_KEY missing or expired in Netlify env vars
  - NVIDIA free-tier rate limit hit for the day
In that case, check your Netlify function logs for "[chat/ai]" lines --
they log the exact model tried and the exact HTTP status/error text
NVIDIA returned, which will tell you precisely what's wrong.
