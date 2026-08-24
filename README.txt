IMPRESSIONS-FIRST SHOP SORT — v2 (ASAL FIX)
=============================================
Pehle wala zip sirf ranking priority (impressions-first) fix karta tha,
lekin asli bug alag nikla:

  activity_events table par Row Level Security (RLS) hai. Anon key
  (getServerSupabase) se woh table read nahi ho pa rahi thi, isliye
  fetchPopularityRankServer() hamesha khaali result de raha tha aur
  shop page popularity ranking silently fail ho rahi thi (fallback
  order = Bestseller/featured-first, jo tum dekh rahe the).

  Fix: dono files ab getSupabaseAdmin() (service role key, RLS bypass)
  use karte hain — same jaisa Admin > Analytics aur top-variant-server.ts
  pehle se karte hain.

Files (same path structure, project root me overwrite karke paste karo):

  lib/popularity-rank-server.ts
  app/api/products/popularity/route.ts

Push karne ke baad 1-2 min wait karke /shop hard-refresh (incognito)
karke check karo — sabse zyada impression wala product (abhi
"Green Dhakai Jamdani Saree with Kardana Hand Ari Work", 1205
impressions) sabse upar dikhna chahiye.

changes-v2.diff me exact diff hai:
  git apply changes-v2.diff
