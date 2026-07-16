export type Category =
  | 'Silk Sarees'
  | 'Cotton Sarees'
  | 'Lehenga'
  | 'Anarkali'
  | 'Kurti'
  | 'Bridal';

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
  images: string[];
  rating: number;
  reviews: number;
  featured?: boolean;
  stock_quantity: number;
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
  images: string[] | null;
  stock_quantity: number;
  rating: number;
  reviews: number;
  featured: boolean;
  in_stock: boolean;
  created_at: string;
  updated_at: string;
}
