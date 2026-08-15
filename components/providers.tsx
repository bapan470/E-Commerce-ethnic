'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { CartProvider, CategoriesProvider, PaymentDiscountProvider } from '@/lib/cart-context';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from 'sonner';
import CartDrawer from './cart-drawer';
import Header from './header';
import FeatureStrip from './feature-strip';
import Footer from './footer';
import MobileBottomNav from './mobile-bottom-nav';
import SiteBanner from './site-banner';
import WhatsAppButton from './whatsapp-button';
import LiveChatWidget from './live-chat-widget';
import ActivityTracker from './activity-tracker';
import AffiliateTracker from './affiliate-tracker';
import UrgencyBanner from './growth/urgency-banner';
import SaleCountdownBar from './growth/sale-countdown-bar';
import ExitIntentModal from './growth/exit-intent-modal';
import SocialProofToast from './growth/social-proof-toast';

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isAdminRoute = pathname?.startsWith('/admin');
  const hideChatWidget =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/checkout');

  // Admin panel renders its own full layout (AdminShell: sidebar, sticky
  // header, main content area). Wrapping it in the storefront chrome below
  // (Header/FeatureStrip/SiteBanner/Footer) stacked two full-height layouts
  // on top of each other -- pushing AdminShell's content down and making
  // pages look cut off / "half shown", especially on short mobile viewports.
  // Admin still needs the context providers (cart/auth/categories) since
  // some admin panels reuse storefront hooks, so only the visual chrome is
  // skipped here, not the providers themselves.
  if (isAdminRoute) {
    return (
      <AuthProvider>
        <CategoriesProvider>
          <PaymentDiscountProvider>
            <CartProvider>
              {children}
              <Toaster position="top-center" richColors closeButton />
            </CartProvider>
          </PaymentDiscountProvider>
        </CategoriesProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <CategoriesProvider>
        <PaymentDiscountProvider>
          <CartProvider>
            <ActivityTracker />
            <AffiliateTracker />
            <div className="flex min-h-screen flex-col bg-background">
              <UrgencyBanner />
              <SaleCountdownBar />
              <Header />
              <FeatureStrip />
              <SiteBanner />
              <main className={`flex-1 ${isHome ? 'pb-16 md:pb-0' : ''}`}>{children}</main>
              <Footer />
              <CartDrawer />
              <WhatsAppButton />
              {!hideChatWidget && <LiveChatWidget />}
              <ExitIntentModal />
              <SocialProofToast />
              {isHome && <MobileBottomNav />}
            </div>
            <Toaster position="top-center" richColors closeButton />
          </CartProvider>
        </PaymentDiscountProvider>
      </CategoriesProvider>
    </AuthProvider>
  );
}
