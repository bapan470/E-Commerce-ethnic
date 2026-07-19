'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useCallback,
} from 'react';
import { CartItem, Product, CategoryRow } from './types';
import { fetchProducts, fetchCategories } from './products-api';
import { validateCoupon, computeCouponDiscount, Coupon, CouponResult } from './coupons-api';

/* ---------------- Cart ---------------- */

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD'; product: Product; size: string; quantity?: number }
  | { type: 'REMOVE'; productId: string; size: string }
  | { type: 'UPDATE_QTY'; productId: string; size: string; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; items: CartItem[] };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const qty = action.quantity ?? 1;
      const existing = state.items.find(
        (i) => i.product.id === action.product.id && i.size === action.size
      );
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product.id === action.product.id && i.size === action.size
              ? { ...i, quantity: i.quantity + qty }
              : i
          ),
        };
      }
      return {
        items: [...state.items, { product: action.product, size: action.size, quantity: qty }],
      };
    }
    case 'REMOVE':
      return {
        items: state.items.filter(
          (i) => !(i.product.id === action.productId && i.size === action.size)
        ),
      };
    case 'UPDATE_QTY':
      return {
        items: state.items
          .map((i) =>
            i.product.id === action.productId && i.size === action.size
              ? { ...i, quantity: Math.max(0, action.quantity) }
              : i
          )
          .filter((i) => i.quantity > 0),
      };
    case 'CLEAR':
      return { items: [] };
    case 'HYDRATE':
      return { items: action.items };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (product: Product, size: string, quantity?: number) => void;
  removeItem: (productId: string, size: string) => void;
  updateQuantity: (productId: string, size: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  /** Coupon currently applied to the cart, shared across cart drawer, cart page & checkout. */
  appliedCoupon: Coupon | null;
  /** Rupee amount saved by the applied coupon, recalculated live against the current subtotal. */
  couponDiscount: number;
  applyCoupon: (code: string) => Promise<CouponResult>;
  removeCoupon: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const STORAGE_KEY = 'saaj-cart-v1';
const COUPON_STORAGE_KEY = 'saaj-cart-coupon-v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  const [isCartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        dispatch({ type: 'HYDRATE', items: parsed });
      }
      const rawCoupon = localStorage.getItem(COUPON_STORAGE_KEY);
      if (rawCoupon) {
        setAppliedCoupon(JSON.parse(rawCoupon) as Coupon);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // ignore
    }
  }, [state.items, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (appliedCoupon) {
        localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
      } else {
        localStorage.removeItem(COUPON_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [appliedCoupon, hydrated]);

  const addItem = useCallback(
    (product: Product, size: string, quantity?: number) => {
      dispatch({ type: 'ADD', product, size, quantity });
      setCartOpen(true);
    },
    []
  );
  const removeItem = useCallback((productId: string, size: string) => {
    dispatch({ type: 'REMOVE', productId, size });
  }, []);
  const updateQuantity = useCallback(
    (productId: string, size: string, quantity: number) => {
      dispatch({ type: 'UPDATE_QTY', productId, size, quantity });
    },
    []
  );
  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR' });
    setAppliedCoupon(null);
  }, []);

  const count = useMemo(
    () => state.items.reduce((sum, i) => sum + i.quantity, 0),
    [state.items]
  );
  const subtotal = useMemo(
    () => state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    [state.items]
  );

  // Recalculated live off the current subtotal and item count (not stored
  // as a frozen number) so it stays correct as items are added/removed
  // anywhere in the app — cart drawer, cart page, or checkout. Flat
  // coupons are priced per distinct product line, so adding/removing a
  // product updates the discount too, not just changing quantities.
  const couponDiscount = useMemo(() => {
    if (!appliedCoupon || subtotal <= 0) return 0;
    if (subtotal < appliedCoupon.min_order_value) return 0;
    return computeCouponDiscount(appliedCoupon, subtotal, state.items.length);
  }, [appliedCoupon, subtotal, state.items.length]);

  const applyCoupon = useCallback(
    async (code: string): Promise<CouponResult> => {
      const result = await validateCoupon(code, subtotal, state.items.length);
      if (result.ok && result.coupon) {
        setAppliedCoupon(result.coupon);
      }
      return result;
    },
    [subtotal, state.items.length]
  );

  const removeCoupon = useCallback(() => setAppliedCoupon(null), []);

  const value: CartContextValue = {
    items: state.items,
    count,
    subtotal,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    isCartOpen,
    setCartOpen,
    appliedCoupon,
    couponDiscount,
    applyCoupon,
    removeCoupon,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

/* ---------------- Products (Supabase-backed) ---------------- */

interface ProductsContextValue {
  products: Product[];
  categories: CategoryRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getBySlug: (slug: string) => Product | undefined;
  getById: (id: string) => Product | undefined;
}

const ProductsContext = createContext<ProductsContextValue | undefined>(undefined);

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prods, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getBySlug = useCallback(
    (slug: string) => products.find((p) => p.slug === slug),
    [products]
  );
  const getById = useCallback(
    (id: string) => products.find((p) => p.id === id),
    [products]
  );

  const value: ProductsContextValue = {
    products,
    categories,
    loading,
    error,
    refresh,
    getBySlug,
    getById,
  };

  return (
    <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider');
  return ctx;
}
