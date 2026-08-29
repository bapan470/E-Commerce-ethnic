Changed file: components/product/variant-swatches.tsx

Bug kya tha:
Product page pe "Colour" swatches ki row mobile pe horizontally
scrollable hai (wrap nahi hoti). Jab aap kisi aise variant ka link
seedha khol te the jo list me aage/last me tha (jaise "Navy Blue"),
to page load hote hi wo highlighted swatch scroll-strip ke right
side me (screen se bahar) hota tha — code me wo sahi se "selected"
tha (upar "Colour — Navy Blue" bhi likha aata tha), bas dikh nahi
raha tha kyunki row scroll hokar uss tak nahi pahunchti thi.

Fix:
Ab jab bhi active/selected variant badalta hai (page load pe bhi,
aur switch karne pe bhi), uska swatch automatically horizontal
scroll strip me center me la kar dikhaya jata hai — chahe wo list
me pehla ho ya sabse last, hamesha visible + highlighted dikhega.

Apply kaise karein:
Apne project me components/product/variant-swatches.tsx ko is
file se replace kar dein.
