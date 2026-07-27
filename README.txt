IMAGE SEARCH — AI TOGGLE (Admin) + REAL AI SEARCH
====================================================

Ismein 2 cheezein hain:

1) Pehle wala TypeScript build-fix (lib/image-search.ts) — already included.

2) NAYA: Admin me ek ON/OFF toggle jo control karta hai ki "search by
   photo" (camera icon) REAL AI (NVIDIA vision model) use kare ya sirf
   free color-matching use kare.

FILES IN THIS ZIP (apne repo me isi path pe replace/add karo):

  lib/image-search.ts                    -> REPLACE (TS bug fix, same as pehle)
  lib/settings-api.ts                    -> REPLACE (naya ImageSearchAiSettings add hua)
  app/api/image-search/route.ts          -> NAYI FILE (server-side AI route)
  components/header.tsx                  -> REPLACE (pehle AI route try karega, fail/off ho to color-match pe fallback)
  components/admin/settings-panel.tsx    -> REPLACE (naya "Search by Photo — AI" toggle section)
  app/shop/page.tsx                      -> same as pehle (no new change, reference ke liye)

KYA HOTA HAI AB:
  - Admin panel > Settings me neeche "Search by Photo — AI" section milega,
    jisme ek checkbox hai: "Enable AI-powered search by photo".
  - TOGGLE ON: shopper photo upload karta hai to woh NVIDIA ke vision model
    (meta/llama-3.2-90b-vision-instruct) ko bheji jaati hai, jo photo se
    garment type (saree/lehenga/kurti), color(s), pattern, aur style
    keywords nikalta hai — phir catalog ke products ko in attributes se
    match karke rank karta hai. Ye SHAPE/PATTERN bhi samajhta hai, sirf
    color nahi (jo pehle wala method nahi karta tha).
  - TOGGLE OFF (default): pehle wala free, instant, browser-side
    color-fingerprint match hi chalega — koi AI call nahi hogi.
  - Agar AI toggle ON hai lekin NVIDIA_API_KEY set nahi hai, ya AI call
    fail/timeout/rate-limit ho jaaye, to automatically color-match pe
    fallback ho jaata hai — feature kabhi break nahi hota, shopper ko
    result hamesha milega.

NVIDIA_API_KEY:
  Agar aapke Vercel project me already NVIDIA_API_KEY env var set hai
  (AI Chat / "Generate with AI" feature ke liye), to yehi key reuse hoti
  hai — koi naya setup nahi chahiye. Agar nahi hai, to free key
  build.nvidia.com se milti hai, Vercel > Project Settings > Environment
  Variables me NVIDIA_API_KEY naam se add karo aur redeploy karo.

DATABASE:
  Koi naya migration/table nahi chahiye — yeh setting existing `settings`
  table me hi ek naya row (key = 'image_search_ai') ke roop me save hoti
  hai, jaise baaki saari settings (ai_chat, store_info, etc.) already
  save hoti hain.

APPLY:
  git add lib/image-search.ts lib/settings-api.ts app/api/image-search/route.ts components/header.tsx components/admin/settings-panel.tsx app/shop/page.tsx
  git commit -m "Add AI toggle for search-by-photo (NVIDIA vision model + fallback)"
  git push

Maine `tsc --noEmit` chala ke confirm kar liya hai — sab files clean
type-check ho rahi hain, koi build error nahi.
