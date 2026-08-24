# Implementation Guide: Show Top Products Based on Clicks/Views

## Overview
This implementation makes products with the most clicks, views, and purchases appear at the top of shop and category pages - just like Google Ads shows top-performing ads first.

## Files to Replace/Update

### 1. **lib/popularity-rank-server.ts** ✓ (REPLACE)
The core ranking engine. This file:
- Fetches activity events from Supabase (purchases, views, cart adds, clicks)
- Calculates weighted scores for each product
- Applies time decay (recent events matter more)
- Returns products ranked by engagement

**Key Features:**
- Purchase: 100 points (highest value)
- Checkout Start: 30 points
- Add to Cart: 10 points  
- Product Click: 2 points
- Wishlist Add: 5 points
- Product View: 1 point

- Recent events (0-7 days): Full weight
- Medium term (7-30 days): 70% weight
- Older (30-90 days): 30% weight

### 2. **app/shop/shop-content.tsx** (UPDATE - line 48-52)
Already has `initialSort = 'popularity'` as default ✓

**Optional enhancement:** Add trending badge to quick filters:
```typescript
// Add this to QUICK_FILTERS
{ key: 'popularity', label: 'Trending Now', icon: Flame }
```

### 3. **components/category/category-toolbar-grid.tsx** (VERIFY - already correct)
Already defaults to popularity sort ✓
Already fetches popularity updates every 10 minutes ✓

### 4. **components/trending-badge.tsx** ⭐ (NEW - RECOMMENDED)
Add visual "TRENDING" badges to top 10 products
- Shows on product cards
- Animates with pulse effect
- Highlights best performers to customers

## How It Works

### Data Flow:
1. **User Action** (view, click, purchase) → Tracked in `activity_events` table
2. **Supabase Trigger** → Records event with timestamp and product_id
3. **Server-side Fetch** → `fetchPopularityRankServer()` calculates rankings
4. **Products Sorted** → Listed by popularity score on /shop and /category pages
5. **Client Display** → Users see best-selling products first

### Activity Events Tracked:
- `product_view` - User viewed a product
- `product_click` - User clicked on product link
- `add_to_cart` - User added to shopping cart
- `checkout_start` - User initiated checkout
- `purchase` - User completed purchase
- `wishlist_add` - User saved product

## Database Schema Required

Make sure your Supabase has an `activity_events` table with:
```sql
CREATE TABLE activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  user_id UUID,
  INDEX (product_id),
  INDEX (created_at),
  INDEX (event_type)
);
```

## API Endpoints Used

### `/api/products/popularity` (GET)
**Returns:**
```json
{
  "ranked": ["product-id-1", "product-id-2", "product-id-3", ...]
}
```
Used by category pages to refresh popularity rankings every 10 minutes.

## Testing the Implementation

### Test 1: Verify Popularity Sorting
1. Go to `/shop` - products should be sorted by engagement
2. Go to `/category/sarees` - products should be sorted by engagement
3. Sort dropdown should show "Popularity" as first option

### Test 2: Check Trending Badges
1. Add the `trending-badge.tsx` component
2. Products in top 10 by popularity should show "TRENDING" badge
3. Badge should be animated

### Test 3: Verify Data Collection
1. Make sure clicks/views are being tracked in `activity_events` table
2. Check Supabase dashboard → activity_events table
3. Should see entries for product views, clicks, purchases

## Performance Considerations

1. **Server-side Ranking**: Computed once per request, cached for 60 seconds
2. **Client Refresh**: Category pages refresh every 10 minutes (configurable)
3. **Time Decay**: Automatically reduces weight of old events
4. **Indexed Queries**: Fast lookups on product_id and created_at

## Configuration

### Adjust Weights (in popularity-rank-server.ts)
```typescript
const WEIGHTS: Record<string, number> = {
  purchase: 100,        // ← Increase to prioritize sales more
  checkout_start: 30,
  add_to_cart: 10,
  product_view: 1,      // ← Increase to value views more
  product_click: 2,
  wishlist_add: 5,
};
```

### Adjust Time Windows (in popularity-rank-server.ts)
```typescript
const WEIGHT_DECAY = {
  recent_days: 7,       // ← Extend for longer recent period
  medium_days: 30,
  older_days: 90,
};
```

### Trending Badge Threshold (in trending-badge.tsx or shop-content.tsx)
```typescript
// Show trending badge for top N products (currently 10)
if (rankIndex !== undefined && rankIndex < 10) {
  // Show badge
}
```

## Troubleshooting

### Products not sorting by popularity
- Check that `activity_events` table has recent entries
- Verify tracking is working with `trackEvent()` calls
- Clear browser cache and hard refresh

### Empty popularity ranking
- Make sure Supabase connection is working
- Check that products exist and have activity
- Look at server logs for query errors

### Badges not showing
- Make sure trending-badge component is imported
- Check CSS classes are in Tailwind config
- Verify rankIndex is being passed correctly

## Next Steps

1. ✓ Copy `popularity-rank-server.ts` to `lib/`
2. ✓ Copy `trending-badge.tsx` to `components/` (optional)
3. ✓ Update shop-content.tsx QUICK_FILTERS (optional)
4. ✓ Test sorting on /shop and /category pages
5. ✓ Monitor activity_events table for tracking data
6. ✓ Adjust weights based on business goals

## Support

For issues or questions:
- Check Supabase activity_events table for data
- Verify server logs for errors
- Test with different products
- Review popularity-rank-server.ts for scoring logic
