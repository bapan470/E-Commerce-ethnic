'use client';

import { Heart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useProductTracking } from '@/hooks/useProductTracking';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
  rating?: number;
  reviews?: number;
  views?: number;
  discount?: number;
  badge?: string;
}

interface ProductCardProps {
  product: Product;
  onProductClick?: () => void;
}

export default function ProductCard({ product, onProductClick }: ProductCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const { trackView } = useProductTracking();

  const handleClick = async () => {
    // Track the view
    await trackView(product.id, 'click');

    // Execute callback if provided
    if (onProductClick) {
      onProductClick();
    }
  };

  const handleMouseEnter = async () => {
    // Track hover/impression
    await trackView(product.id, 'impression');
  };

  const discountedPrice = product.discount 
    ? Math.round(product.price * (1 - product.discount / 100))
    : product.price;

  return (
    <Link href={`/product/${product.id}`}>
      <div
        className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition cursor-pointer group"
        onMouseEnter={handleMouseEnter}
        onClick={handleClick}
      >
        {/* Image Container */}
        <div className="relative h-64 bg-gray-100 overflow-hidden">
          {product.image_url && (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-110 transition duration-300"
            />
          )}

          {/* Badge */}
          {product.badge && (
            <div className="absolute top-3 left-3 bg-burgundy text-white px-3 py-1 rounded-full text-xs font-semibold">
              {product.badge}
            </div>
          )}

          {/* Discount Badge */}
          {product.discount && (
            <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
              -{product.discount}%
            </div>
          )}

          {/* Favorite Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsFavorite(!isFavorite);
            }}
            className="absolute bottom-3 right-3 bg-white rounded-full p-2 hover:bg-gray-100 transition shadow-md"
          >
            <Heart
              size={20}
              className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}
            />
          </button>

          {/* Views Badge */}
          {product.views && product.views > 0 && (
            <div className="absolute bottom-3 left-3 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs">
              👁️ {product.views} views
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-4">
          {/* Name */}
          <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm mb-2">
            {product.name}
          </h3>

          {/* Rating */}
          {product.rating && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex text-yellow-400">
                {'★'.repeat(Math.floor(product.rating))}
              </div>
              <span className="text-xs text-gray-600">
                ({product.reviews || 0} reviews)
              </span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-center gap-2 mb-3">
            <span className="font-bold text-lg text-burgundy">₹{discountedPrice}</span>
            {product.discount && (
              <span className="text-sm text-gray-500 line-through">₹{product.price}</span>
            )}
          </div>

          {/* Buy Button */}
          <button
            className="w-full bg-burgundy text-white py-2 rounded hover:bg-opacity-90 transition text-sm font-semibold"
            onClick={(e) => {
              e.preventDefault();
              handleClick();
            }}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </Link>
  );
}
