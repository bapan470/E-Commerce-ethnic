AI CHATBOT FIX v3 — replace these 2 files in your repo, then commit & push
=========================================================================

WHY v1/v2 DIDN'T FULLY WORK
----------------------------
Your logs showed that even the "safety net" models I picked from a web
search (Llama 4 Maverick, Nemotron-Super-49B, Mistral Small 3.1, Mistral
Nemotron) were ALSO dead or wrong within the same week:
  - meta/llama-4-maverick-17b-128e-instruct -> 410 (EOL 2026-07-27)
  - nvidia/llama-3.3-nemotron-super-49b-v1  -> 410 (EOL 2026-08-26)
  - mistralai/mistral-small-3.1-24b-instruct-2503 -> 404 (wrong slug)
  - mistralai/mistral-nemotron -> 500 (server error)
NVIDIA's free-tier catalog is being pruned faster than any hardcoded
model name can keep up with -- so a hardcoded list was the wrong fix.

WHAT v3 DOES INSTEAD
---------------------
app/api/chat/ai/route.ts now calls NVIDIA's own `GET /v1/models` at
request time (same auth, standard OpenAI-compatible endpoint) to get
the REAL, CURRENT list of models on your account, filters out non-chat
models (embeddings, safety/guardrail, speech, image-gen), ranks the
rest by name (prefers "instruct"/"chat", deprioritizes vision models,
favors smaller/faster ones), and tries up to 6 of them in order. The
live list is cached in-memory for 15 minutes so it's not re-fetched on
every single message.

This means the widget self-heals the next time NVIDIA retires more
models -- no code change needed.

Also (unchanged from v1/v2):
  - lib/settings-api.ts's DEFAULT_AI_CHAT_SETTINGS no longer pins any
    specific model (left blank) so it can't accidentally force a dead
    one when no admin override exists.
  - Settings lookup wrapped in try/catch so a transient failure can't
    silently produce an HTML error page instead of JSON.

ONE MANUAL STEP RECOMMENDED
-----------------------------
Your Vercel logs show the widget is currently trying "meta/llama-3.3-
70b-instruct" FIRST on every request -- this means Admin > Settings >
AI Chat Assistant on your live site has a real saved value pinning that
dead model. It's harmless now (a 410 fails almost instantly, then the
live-discovered models take over), but for a slightly faster first
reply, open that admin panel and clear/blank the Primary and Fallback
model fields, then save. Leaving them blank lets the new live-discovery
logic pick automatically.

FILES IN THIS ZIP (same folder structure as your repo root):
  app/api/chat/ai/route.ts
  lib/settings-api.ts

HOW TO APPLY
------------
Copy these 2 files into your repo, overwriting the existing ones at the
same paths, then:
    git add app/api/chat/ai/route.ts lib/settings-api.ts
    git commit -m "fix: AI chat now discovers live NVIDIA models at request time"
    git push

Or apply CHANGES.diff:
    git apply CHANGES.diff

AFTER DEPLOYING
---------------
Test the widget with a real question. If it still errors, check Vercel
Runtime Logs for "[chat/ai]" again -- you'll now also see a
"[chat/ai] live model catalog lookup failed" line if the /v1/models
call itself is failing (would point to the API key or NVIDIA account
itself, not any specific model), which is useful new information we
didn't have before.

HEADS UP -- OTHER FEATURES USE THE SAME (NOW-DEAD) MODEL NAMES
-------------------------------------------------------------------
These files were NOT touched and still reference retired models
directly (they don't have the new live-discovery logic):
  app/api/admin/generate-blog-post/route.ts   (meta/llama-3.1-8b-instruct)
  app/api/admin/generate-listing/route.ts     (meta/llama-3.2-11b-vision-instruct)
  app/api/admin/image-search-ai-test/route.ts (meta/llama-3.2-90b-vision-instruct)
  app/api/admin/detect-variant-color/route.ts (meta/llama-3.2-11b-vision-instruct)
  app/api/image-search/route.ts               (meta/llama-3.2-90b-vision-instruct)
  lib/vendor-ai-listing.ts                    (meta/llama-3.2-11b-vision-instruct)
If "Generate with AI" (product listings), photo search, or vendor AI
listing tools are also failing/erroring, let me know and I'll apply the
same live-discovery fix to those.
