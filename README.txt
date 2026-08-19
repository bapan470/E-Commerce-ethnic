Kya add hua (Hinglish):

Pehle checkout sirf ye check karta tha ki PIN code "format" me sahi hai
(6 digit, 1-9 se shuru) -- ye check nahi hota tha ki wo PIN code REAL me
exist karta hai ya nahi. Isliye koi customer galti se "411111" jaisa kuch
bhi type kar deta (format sahi, real nahi), to order place ho jata tha,
aur pata tab chalta jab Delhivery shipment banate waqt reject karta.

Ab: lib/pincode-api.ts already India Post ke real database
(api.postalpincode.in) se check karta tha (auto-fill ke liye) -- bas is
result ko ab checkout submit hone se PEHLE bhi use kar rahe hain,
taaki fake/non-existent pincode par order place hi na ho.

1. lib/pincode-api.ts
   - PincodeResult me naya field: `verified: 'yes' | 'no' | 'unknown'`
       'yes'     -> India Post ne real match dhoondh liya, genuine pincode
       'no'      -> India Post ne successfully respond kiya lekin koi
                    match nahi mila -- ye pincode exist nahi karta
       'unknown' -> India Post ka API hi down/unreachable tha, isliye
                    confirm nahi kar paye (is case me checkout BLOCK
                    nahi hota -- warna real customer bhi phas jayega
                    agar third-party API thodi der down ho)

2. app/checkout/page.tsx
   - PIN code field ke neeche ab LIVE status dikhta hai:
       "Checking pincode…" (lookup ho raha hai)
       "✓ Verified: <City>, <State>" (green, sahi pincode)
       "This PIN code doesn't seem to exist..." (red, galat pincode) +
       field ka border bhi red ho jata hai
   - Order place karte waqt (Place Order button click par), agar pincode
     verified === 'no' hai, to order BLOCK ho jayega aur customer ko
     clear error message milega -- order place hi nahi hoga jab tak
     sahi pincode na daale.
   - Agar India Post API down ho (verified === 'unknown'), to order
     block NAHI hoga -- customer atka nahi rahega.

Apply kaise kare:
  Project folder me:
    git apply CHANGES.patch
  (conflict aaye to 2 files manually replace kar dena: app/checkout/page.tsx
  aur lib/pincode-api.ts)

Uske baad:
    git add -A
    git commit -m "Verify PIN code actually exists before allowing checkout"
    git push

Test:
  [ ] Checkout par ek real pincode daalo (jaise 400050) -> green
      "Verified" message aana chahiye, City/State auto-fill honi chahiye.
  [ ] Ek fake pincode daalo jo format me sahi ho lekin exist na kare
      (jaise 411119 agar wo kisi post office se match na ho, ya koi bhi
      random 6-digit jo exist na kare) -> red error aana chahiye, aur
      "Place Order" click karne par order place NAHI hona chahiye.
