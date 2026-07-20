'use client';

import React from 'react';
import { CartProvider, ProductsProvider } from '@/lib/cart-context';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from 'sonner';
import CartDrawer from './cart-drawer';
import Header from './header';
import Footer from './footer';
import SiteBanner from './site-banner';
import WhatsAppButton from './whatsapp-button';
import LiveChatWidget from './live-chat-widget';
import ActivityTracker from './activity-tracker';
import UrgencyBanner from './growth/urgency-banner';
import SaleCountdownBar from './growth/sale-countdown-bar';
import ExitIntentModal from './growth/exit-intent-modal';
import SocialProofToast from './growth/social-proof-toast';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProductsProvider>
        <CartProvider>
          <ActivityTracker />
          <div className="flex min-h-screen flex-col bg-background">
            <UrgencyBanner />
            <SaleCountdownBar />
            <Header />
            <SiteBanner />
            <main className="flex-1">{children}</main>
            <Footer />
            <CartDrawer />
            <WhatsAppButton />
            <LiveChatWidget />
            <ExitIntentModal />
            <SocialProofToast />
          </div>
          <Toaster position="top-center" richColors closeButton />
        </CartProvider>
      </ProductsProvider>
    </AuthProvider>
  );
}
