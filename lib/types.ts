export type Category =
  | 'Silk Sarees'
  | 'Cotton Sarees'
  | 'Lehenga'
  | 'Anarkali'
  | 'Kurti'
  | 'Bridal';

/**
 * Extra "Product Highlights" attributes shown on the PDP in the Meesho-style
 * collapsible spec block (Fit/Shape, Length up top; Neck, Sleeve, Net
 * Quantity etc. under "Additional Details"). All optional — the AI listing
 * generator fills these in from the name/photo, and the admin can edit them.
 */
export interface ProductHighlights {
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
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
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
  stock_quantity: number;
  low_stock_threshold?: number;
  rating: number;
  reviews: number;
  featured: boolean;
  in_stock: boolean;
  created_at: string;
  updated_at: string;
}
