# Blog "Generate with AI" — 500/504 timeout fix

## Root cause
`app/api/admin/generate-blog-post/route.ts` was calling NVIDIA NIM's free
tier using `meta/llama-3.2-11b-vision-instruct` — the VISION model — even
though this route is text-only (no product photo involved, unlike
`generate-listing`/`vendor-ai-listing`, which genuinely need vision).

Generating a long ~900-1300 word JSON blog post on the 11b vision model was
consistently taking 48s+ on NIM's free tier, which blew past the 48s
AbortController timeout in the code → logged in Vercel as:

```
[generate-blog-post] NIM fetch failed (timed out after 48000ms):
[DOMException [AbortError]: This operation was aborted]
```

...and the request came back as a 500/504 to the admin UI every time,
because on a pure timeout the old code did NOT retry — it just failed.

## What changed (only this one file)
1. **Model switched** from `meta/llama-3.2-11b-vision-instruct` to
   `meta/llama-3.1-8b-instruct` — a much faster text-only NIM model, since
   no image is involved here. Same `NVIDIA_API_KEY`, nothing new to
   configure.
2. **Retry-on-timeout added.** Previously only a `truncated` response
   retried; a `timeout` failed outright. Now both trigger one retry with a
   shorter/stricter prompt and smaller token budget.
3. **Time budget rebalanced** to fit the retry inside Vercel's 60s ceiling:
   first attempt 35s (was 48s) → retry 18s (was 9s) → still leaves room for
   the DB reads before/after.

## To apply
Replace `app/api/admin/generate-blog-post/route.ts` in your repo with the
copy in this zip (or apply `generate-blog-post-fix.patch` with
`git apply generate-blog-post-fix.patch`), then commit & push.

## After deploying
Test "Generate with AI" again on `/admin?section=blog`. If NVIDIA's free
tier is *itself* down/rate-limited at that exact moment you may still see
one clean error toast (by design — it now says so explicitly), but it
should no longer be a hard 500/504 on every attempt.
