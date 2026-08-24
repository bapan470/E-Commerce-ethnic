'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import ProductCard from '@/components/product-card';
import { useProductTracking } from '@/hooks/useProductTracking';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
  views: number;
  clicks: number;
  // ... other fields
}

export default function ShopContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sortBy, setSortBy] = useState<'popular' | 'new' | 'price-low' | 'price-high'>('popular');
  const [loading, setLoading] = useState(true);
  const { handleProductClick } = useProductTracking();

  useEffect(() => {
    fetchAndSortProducts();
  }, [sortBy]);

  async function fetchAndSortProducts() {
    try {
      setLoading(true);
      let query = supabase.from('products').select('*');

      // Sort based on selected option
      switch (sortBy) {
        case 'popular':
          query = query.order('views', { ascending: false });
          break;
        case 'new':
          query = query.order('created_at', { ascending: false });
          break;
        case 'price-low':
          query = query.order('price', { ascending: true });
          break;
        case 'price-high':
          query = query.order('price', { ascending: false });
          break;
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSort = (newSort: typeof sortBy) => {
    setSortBy(newSort);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-burgundy"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Sorting Bar */}
      <div className="flex items-center justify-between mb-8 px-4 md:px-8">
        <div className="flex items-center gap-4">
          <span className="text-gray-600 text-sm">{products.length} products found</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleSort('popular')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition ${
              sortBy === 'popular'
                ? 'bg-burgundy text-white'
                : 'border border-gray-300 text-gray-700 hover:border-burgundy'
            }`}
          >
            Popularity
            <ChevronDown size={16} />
          </button>

          <button
            onClick={() => handleSort('new')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition ${
              sortBy === 'new'
                ? 'bg-burgundy text-white'
                : 'border border-gray-300 text-gray-700 hover:border-burgundy'
            }`}
          >
            Bestseller
          </button>

          <button
            onClick={() => handleSort('price-low')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition ${
              sortBy === 'price-low'
                ? 'bg-burgundy text-white'
                : 'border border-gray-300 text-gray-700 hover:border-burgundy'
            }`}
          >
            Price: Low
          </button>

          <button
            onClick={() => handleSort('price-high')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition ${
              sortBy === 'price-high'
                ? 'bg-burgundy text-white'
                : 'border border-gray-300 text-gray-700 hover:border-burgundy'
            }`}
          >
            Price: High
          </button>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 md:px-8">
        {products.map((product) => (
          <div key={product.id}>
            <ProductCard
              product={product}
              onProductClick={() => {
                handleProductClick(product.id, () => {
                  // Navigate to product page
                  window.location.href = `/product/${product.id}`;
                });
              }}
            />
            {/* Show popularity badge */}
            {product.views > 0 && (
              <div className="text-xs text-gray-500 mt-2">
                👁️ {product.views} views
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {products.length === 0 && (
        <div className="flex justify-center items-center min-h-96">
          <p className="text-gray-500 text-lg">No products found</p>
        </div>
      )}
    </div>
  );
}
