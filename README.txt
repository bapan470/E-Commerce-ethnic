AI CHATBOT FIX v2 — replace these 2 files in your repo, then commit & push
=========================================================================

CONFIRMED ROOT CAUSE (from your Vercel runtime logs, 2026-09-03):
NVIDIA retired the ENTIRE free-tier Llama 3.x text lineup on NIM:
  - meta/llama-3.3-70b-instruct  -> 410 Gone (EOL 2026-08-26)
  - meta/llama-3.1-70b-instruct  -> 410 Gone (EOL 2026-08-26)
  - meta/llama-3.1-8b-instruct   -> 410 Gone (EOL 2026-08-26)
  - mistralai/mixtral-8x7b-instruct-v0.1 -> 410 Gone (EOL 2026-07-27)
  - meta/llama-3.2-90b-vision-instruct -> timed out (504)
  - google/gemma-2-9b-it -> 404 (wrong slug on NIM, never worked)
Every model your widget was trying was dead -- so it always fell through
to the generic "having trouble" message.

FILES IN THIS ZIP (same folder structure as your repo root):
  app/api/chat/ai/route.ts
  lib/settings-api.ts

WHAT CHANGED
------------
Switched the chat widget's primary/fallback/safety-net models to ones
confirmed listed as "Free Endpoint" on build.nvidia.com/nim as of this
fix (2026-09-03):
  - mistralai/mistral-small-3.1-24b-instruct-2503  (primary)
  - mistralai/mistral-nemotron                     (fallback)
  - meta/llama-4-maverick-17b-128e-instruct         (safety net)
  - nvidia/llama-3.3-nemotron-super-49b-v1          (safety net)
Also fixed lib/settings-api.ts's DEFAULT_AI_CHAT_SETTINGS (a second,
separate default that route.ts doesn't control -- your store falls
back to this one since no custom value is saved in Admin > Settings >
AI Chat Assistant) to match.
Also wrapped the settings lookup in try/catch so a transient failure
there can't silently produce an HTML error page instead of JSON.

HOW TO APPLY
------------
Option A (simplest): copy these 2 files into your repo, overwriting the
existing ones at the same paths, then:
    git add app/api/chat/ai/route.ts lib/settings-api.ts
    git commit -m "fix: switch AI chat off NVIDIA's retired Llama models"
    git push

Option B: apply CHANGES.diff instead:
    git apply CHANGES.diff

AFTER DEPLOYING
---------------
Test the chat widget on the live site with a real question. If it still
errors, check Vercel Runtime Logs for "[chat/ai]" again -- the same way
you found this -- and send me the new status code/message.

HEADS UP -- OTHER FEATURES MAY BE AFFECTED TOO
------------------------------------------------
The following files use the SAME NVIDIA_API_KEY with vision models that
were NOT touched in this fix (their EOL status isn't confirmed yet, only
the text-chat models above were confirmed via your logs):
  app/api/admin/generate-blog-post/route.ts   (meta/llama-3.1-8b-instruct)
  app/api/admin/generate-listing/route.ts     (meta/llama-3.2-11b-vision-instruct)
  app/api/admin/image-search-ai-test/route.ts (meta/llama-3.2-90b-vision-instruct)
  app/api/admin/detect-variant-color/route.ts (meta/llama-3.2-11b-vision-instruct)
  app/api/image-search/route.ts               (meta/llama-3.2-90b-vision-instruct)
  lib/vendor-ai-listing.ts                    (meta/llama-3.2-11b-vision-instruct)
If "Generate with AI" (product listings), photo search, or vendor AI
listing tools are also failing, that's the same root cause -- let me
know and I'll patch those too.
