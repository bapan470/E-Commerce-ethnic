# Review page — kya change hua

File: `app/review/[token]/page.tsx`

## 1. Rating / Review edit karne ka option
Jab "Rate" ya "Write a review" step already complete ho chuka ho (checkmark
wale chip), ab uspar tap karke customer wapas us step par ja sakta hai aur
apni rating ya review text edit kar sakta hai. Edit karke "Save Changes"
dabane par wo seedha wahi laut aata hai jaha se aaya tha (photo step ya
jaha bhi tha) — pura flow dobara nahi karna padta.
- Photo step edit-jump me shaamil nahi kiya, kyunki uska apna upload box
  already hai (usme change karna already easy hai).
- Edit mode me ek chhota banner dikhta hai: "Editing your rating/review"
  + "Cancel" link, taaki customer confuse na ho.

## 2. Skip button
Pehle sirf underline text tha ("Skip -- submit without a photo..."), jisse
customer ko clear nahi hota tha ki ye ek action button hai. Ab ye ek proper
dashed-border button ban gaya hai, ek `ImageOff` icon ke saath, aur text
short/clear hai: "Skip photo & submit without it (no discount for this
item)".

## 3. Submit button
- Photo attach hai to: "Submit Review with Photo" (photo icon ke saath)
- Photo skip kar rahe ho ya photo step hai hi nahi to: "Submit Review"
  (send icon ke saath)
- Edit mode me: "Save Changes" (check icon ke saath)

Isse customer ko turant pata chal jayega ki button dabane par exactly kya
hoga.

## Apply kaise karein
1. Apne local repo `E-Commerce-ethnic` me `app/review/[token]/page.tsx`
   ko is zip ke andar wali file se replace kar dein.
2. `git add -A && git commit -m "review page: editable rating/review steps, clearer skip & submit buttons" && git push`
3. Deploy/build karke live check kar lein (rate → write → photo → submit
   flow, aur "Rate"/"Write a review" chip par tap karke edit flow).

`CHANGES.diff` file me exact diff bhi diya gaya hai reference ke liye.
