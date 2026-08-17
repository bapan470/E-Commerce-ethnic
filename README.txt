Naya kya add hua (Hinglish):

1. app/api/orders/[id]/cancel/route.ts
   - Pehle ye route har case me login maangta tha ("You must be logged in
     to cancel an order"), isliye guest checkout wale orders kabhi cancel
     nahi ho pate the.
   - Ab: agar order GUEST order hai (koi account se linked nahi -- user_id
     null), to cancel bina login ke ho jayega, bas order ka ID pata hona
     chahiye (jo order-confirmation URL / confirmation email me hota hai
     hi -- same jaisa is URL se already poora order dikh raha hai bina
     login ke).
   - Agar order kisi ACCOUNT se linked hai (user ne login karke order
     kiya tha), to wahan pehle jaisa hi rehta hai -- us account se login
     karna padega cancel karne ke liye (security ke liye).
   - Baaki rules same hain: sirf pending/paid/confirmed status wale orders
     cancel ho sakte hain, aur Admin > Settings me set kiya hua
     "cancellation window" (X ghante) ke andar hi.

2. app/order-confirmation/[id]/page.tsx (Thank You page)
   - Ab is page par bhi "Cancel Order" button dikhega (jab order
     cancellable status me ho), pehle sirf logged-in account ke
     "My Orders" page me hota tha.
   - Isi liye guest customer bhi order place karne ke turant baad, usi
     thank-you page se, bina koi account banaye order cancel kar sakta
     hai.
   - Status badge (Pending/Paid/Shipped/Delivered/Cancelled) bhi already
     is page par dikhta hai (pichle patch se).

3. lib/email-templates.ts, lib/orders-api.ts
   - Pichle patch wale changes hi hain: har status change par customer ko
     automatic email (pichle message me bataya gaya tha).

Apply kaise kare:
  Project folder me:
    git apply CHANGES.patch
  (Agar conflict aaye to zip ke andar ke 4 files manually copy karke
  same path par apne project me replace kar dena:
    - app/order-confirmation/[id]/page.tsx
    - app/api/orders/[id]/cancel/route.ts
    - lib/email-templates.ts
    - lib/orders-api.ts
  )

Uske baad:
    git add -A
    git commit -m "Allow guest order cancellation + cancel button on thank you page"
    git push

Security note: Guest cancel sirf tab allow hota hai jab order kisi bhi
account se linked na ho (guest checkout). Agar customer ne login karke
order kiya tha, cancel ke liye wahi account login zaroori rahega -- warna
koi bhi leaked link se logged-in customer ka order cancel kar sakta tha.
