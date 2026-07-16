'use client';

import React from 'react';
import { CartProvider, ProductsProvider } from '@/lib/cart-context';
import { Toaster } from 'sonner';
import CartDrawer from './cart-drawer';
import Header from './header';
import Footer from './footer';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ProductsProvider>
      <CartProvider>
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <CartDrawer />
        </div>
        <Toaster position="top-center" richColors closeButton />
      </CartProvider>
    </ProductsProvider>
  );
}
