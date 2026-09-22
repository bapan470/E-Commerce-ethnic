# Review notifications — kya add hua

Files:
- `app/api/admin/notifications/route.ts`
- `components/admin/notification-bell.tsx`

## Kya change hua
Ab jab bhi koi naya rating/review submit hota hai, wo top-right ke
notification bell (jaisa "New order received" / "Cart abandoned" dikhta
hai) me bhi dikhega:

- Type: `review`, star icon ke saath.
- Title: "New review received" (agar title/comment likha ho) ya
  "New rating received" (sirf stars diye ho).
- Message: `<Customer name> rated "<Product name>" ★★★★★ (5/5) — "<pehle
  60 characters of review>"`.
- Notification pe click karte hi seedha **Reviews** section khul jaata
  hai (jaisa "Cart abandoned" click par Abandoned Carts khulta hai).

## Approve + Publish + Hide — pehle se hi kaam kar raha hai
Ye repo me already implement hai (koi change nahi kiya, sirf confirm kar
raha hoon):
- Naya review submit hone ke 5 second baad automatically approve/publish
  ho jaata hai (`scheduleAutoPublish` in `lib/reviews-api.ts`) — koi
  manual admin approval ki zaroorat nahi.
- Admin panel > Reviews me har published review ke saamne **Hide**
  button hai — usse dabate hi review turant offline ho jaata hai
  (`is_approved = false`), bina delete kiye. Chahe to baad me firse Hide
  hataake wapas publish kar sakte ho.

Isliye is change ke baad flow ye hoga: review aaya → notification bell me
dikha → 5 sec me auto-publish ho gaya → agar zaroorat pade to admin
"Hide" se turant hata sakta hai.

## Apply kaise karein
1. Dono files apne local repo me isi path par replace kar dein.
2. `git add -A && git commit -m "admin: show new reviews in notification bell" && git push`
3. Deploy karke bell icon check karein — ek test review submit karke
   dekhein ki notification aata hai aur click karne par Reviews section
   khulta hai.

`CHANGES.diff` me exact diff bhi diya hai.

⚠️ Note: pichhle turn me diya gaya `app/review/[token]/page.tsx` (edit
rating/review + skip/submit button) alag zip me tha — agar wo abhi tak
apply nahi kiya to wo bhi zaroor laga lena, ye do files uske upar hi
build hui hain (dependent nahi hain, lekin dono ek hi review-flow ka
hissa hain).
