# Admin Blog table — Views/Clicks/Conversions columns

`components/admin/blog-panel.tsx` — poori file hai (859 -> 884 lines),
sirf yeh 5 jagah badli hain, baaki sab as-is:

1. Import add: `fetchBlogPerformance, BlogPostPerformance`
2. Naya state + `useEffect` jo `/api/admin/blog-performance` call karta hai
3. Table header mein 3 naye columns: Views, Clicks, Conversions
4. Table row mein unke corresponding cells (Status ke baad, Published se pehle)
5. Empty-state rows ka `colSpan={5}` -> `colSpan={8}` (3 naye columns ki wajah se)

Extract karo, `components/admin/blog-panel.tsx` REPLACE karo, phir:
```
git add . && git commit -m "show blog views/clicks/conversions in admin" && git push
```

Deploy hone ke baad Admin > Blog khologe toh Status column ke baad turant
Views/Clicks/Conversions dikhega — jo numbers pichle SQL test mein dikhe
the (saree-shopping-in-mumbai post: 2 views, 1 click), wahi yahan bhi
dikhne chahiye.
