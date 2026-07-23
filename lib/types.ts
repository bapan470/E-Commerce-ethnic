export type Category =
  | 'Silk Sarees'
  | 'Cotton Sarees'
  | 'Lehenga'
  | 'Anarkali'
  | 'Kurti'
  | 'Bridal';

/**
 * Extra "Product Highlights" attributes shown on the PDP in the Meesho-style
 * collapsible spec block (Occasion/Border/Border Width/Blouse up top; the
 * rest under "Additional Details"). All optional — the AI listing generator
 * fills these in from the name/photo, and the admin can edit them.
 */
export interface ProductHighlights {
  // Primary — always visible on the PDP
  border?: string;
  border_width?: string;
  blouse?: string;

  // Saree / fabric specifics
  saree_fabric?: string;
  saree_pattern?: string;
  ornamentation?: string;

  // Blouse specifics
  blouse_fabric?: string;
  pallu_details?: string;
  blouse_pattern?: string;
  blouse_color?: string;

  // Brand / manufacturing
  brand?: string;
  loom_type?: string;

  // Existing spec-sheet fields (still used, esp. for kurtis/lehengas)
  fit_shape?: string;
  length?: string;
  neck?: string;
  sleeve_length?: string;
  sleeve_styling?: string;
  surface_styling?: string;
  print_or_pattern_type?: string;
  net_quantity?: string;
  add_on?: string;
  type?: string;
  generic_name?: string;
  country_of_origin?: string;
  transparency?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: Category;
  price: number; // in INR (whole rupees)
  mrp?: number | null;
  description: string;
  fabric: string;
  origin: string;
  colors: string[];
  /**
   * Every distinct colour this product comes in -- the base product's own
   * colour plus every colour added later as a `product_variants` row,
   * de-duplicated. `colors` above is left untouched (many places rely on
   * `colors[0]` meaning "this exact item/variant's own colour" -- e.g. the
   * cart/checkout use it to tell two colours of the same product apart).
   * This field exists purely so product cards on shop/category pages can
   * show a dot for every colour the product actually comes in, instead of
   * just the one recorded on the base row. Undefined/empty falls back to
   * `colors` wherever it's read.
   */
  all_colors?: string[];
  sizes: string[];
  occasion: string[];
  gender: string;
  age_group: string;
  material: string | null;
  pattern: string | null;
  images: string[];
  video_url?: string | null;
  sku?: string | null;
  highlights?: ProductHighlights | null;
  /** Slug of this product's default colour variant (if any) -- product
   *  cards on shop/category/home should link here instead of the base
   *  product slug, so shoppers land straight on the colour that's meant
   *  to be shown first. */
  default_variant_slug?: string | null;
  /** First image of the default colour variant, used as the card thumbnail
   *  in place of the base product's own photos when variants exist. */
  default_variant_image?: string | null;
  /** The vendor's public storefront collection this product belongs to --
   *  e.g. "Aruhi Weaves's Collection" at /collection/aruhi-weaves-a1b2c3.
   *  Null/undefined if the product has no approved vendor. Shown next to
   *  the category label on the product card and PDP, both clickable. */
  collection?: { name: string; slug: string } | null;
  rating: number;
  reviews: number;
  featured?: boolean;
  stock_quantity: number;
  low_stock_threshold?: number;
  inStock: boolean;
  created_at?: string;
}

export interface CartItem {
  product: Product;
  size: string;
  quantity: number;
  /** True only for the line added via the checkout order-bump upsell toggle.
   *  Needed because the bump is admin-configured as a single fixed product —
   *  if a shopper happens to buy THAT SAME product (any colour variant) as
   *  their main item, matching by product.id alone would misidentify their
   *  own main item as "the bump line" and incorrectly hide its qty +/-. */
  isBump?: boolean;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

/** An admin-created, curated collection (distinct from the auto-generated
 *  per-vendor collection) -- e.g. "Diwali Specials". Managed entirely from
 *  Admin > Collections; shows publicly at /collection/[slug]. */
export interface AdminCollectionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  product_count: number;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  created_at?: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
}

export interface ReturnRequest {
  id: string;
  order_id: string;
  order_item_id: string | null;
  user_id: string | null;
  type: 'return' | 'exchange';
  reason: string;
  status: 'requested' | 'approved' | 'rejected' | 'refunded' | 'completed';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ActivityEventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'checkout_start'
  | 'purchase';

export interface ActivityEvent {
  id: string;
  session_id: string;
  user_id: string | null;
  event_type: ActivityEventType;
  page_path: string | null;
  product_id: string | null;
  order_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface WholesalePricingTier {
  id: string;
  product_id: string;
  min_quantity: number;
  unit_price: number;
  label: string | null;
  created_at?: string;
}

// Shape returned by Supabase (snake_case) — we map to Product on read.
export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  mrp: number | null;
  category_id: string | null;
  category_name: string | null;
  fabric: string | null;
  origin: string | null;
  colors: string[] | null;
  sizes: string[] | null;
  occasion: string[] | null;
  gender: string;
  age_group: string;
  material: string | null;
  pattern: string | null;
  images: string[] | null;
  video_url: string | null;
  sku: string | null;
  highlights: ProductHighlights | null;
  /** Embedded via `product_variants(slug, images, is_default, color)` in the
   *  list queries -- used to resolve the default colour variant for cards,
   *  and (via `color`) to build the full swatch-dot list on the card. */
  product_variants?: { slug: string; images: string[] | null; is_default: boolean; color?: string | null }[] | null;
  stock_quantity: number;
  low_stock_threshold?: number;
  rating: number;
  reviews: number;
  featured: boolean;
  in_stock: boolean;
  created_at: string;
  updated_at: string;
}
