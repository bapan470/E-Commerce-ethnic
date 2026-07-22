"use client";

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminShell, { type AdminSection } from '@/components/admin/admin-shell';
import ProductsPanel from '@/components/admin/products-panel';
import OrdersPanel from '@/components/admin/orders-panel';
import CategoriesPanel from '@/components/admin/categories-panel';
import ReviewsPanel from '@/components/admin/reviews-panel';
import CouponsPanel from '@/components/admin/coupons-panel';
import SettingsPanel from '@/components/admin/settings-panel';
import ReturnsPanel from '@/components/admin/returns-panel';
import SupportTicketsPanel from '@/components/admin/support-tickets-panel';
import ContactMessagesPanel from '@/components/admin/contact-messages-panel';
import AbandonedCartsPanel from '@/components/admin/abandoned-carts-panel';
import MarketingPanel from '@/components/admin/marketing-panel';
import StockNotificationsPanel from '@/components/admin/stock-notifications-panel';
import AnalyticsPanel from '@/components/admin/analytics-panel';
import CustomersPanel from '@/components/admin/customers-panel';
import WholesalePanel from '@/components/admin/wholesale-panel';
import LoyaltyPanel from '@/components/admin/loyalty-panel';
import ReferralsPanel from '@/components/admin/referrals-panel';
import ResellersPanel from '@/components/admin/resellers-panel';
import GiftCardsPanel from '@/components/admin/giftcards-panel';
import VendorsPanel from '@/components/admin/vendors-panel';
import FulfillmentPanel from '@/components/admin/fulfillment-panel';

const PANELS: Record<AdminSection, React.ComponentType> = {
  analytics: AnalyticsPanel,
  products: ProductsPanel,
  categories: CategoriesPanel,
  reviews: ReviewsPanel,
  orders: OrdersPanel,
  customers: CustomersPanel,
  returns: ReturnsPanel,
  'support-tickets': SupportTicketsPanel,
  'contact-messages': ContactMessagesPanel,
  'abandoned-carts': AbandonedCartsPanel,
  'restock-alerts': StockNotificationsPanel,
  wholesale: WholesalePanel,
  coupons: CouponsPanel,
  marketing: MarketingPanel,
  loyalty: LoyaltyPanel,
  referrals: ReferralsPanel,
  resellers: ResellersPanel,
  giftcards: GiftCardsPanel,
  vendors: VendorsPanel,
  fulfillment: FulfillmentPanel,
  settings: SettingsPanel,
};

const VALID_SECTIONS = Object.keys(PANELS) as AdminSection[];

function isAdminSection(value: string | null): value is AdminSection {
  return !!value && (VALID_SECTIONS as string[]).includes(value);
}

function AdminPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize from the URL so a reload (or a shared link) lands on the
  // section the admin was actually looking at instead of always resetting
  // to Analytics. Old "?section=variants" links (from before variants moved
  // inside Products) fall back to Products instead of a blank panel.
  const rawSection = searchParams.get('section');
  const initialSection = isAdminSection(rawSection)
    ? (rawSection as AdminSection)
    : rawSection === 'variants'
    ? 'products'
    : 'analytics';

  const [active, setActive] = useState<AdminSection>(initialSection);

  // If the user navigates with back/forward, or the URL changes externally,
  // keep the panel in sync with it.
  useEffect(() => {
    const fromUrl = searchParams.get('section');
    if (isAdminSection(fromUrl) && fromUrl !== active) {
      setActive(fromUrl);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback(
    (section: AdminSection) => {
      setActive(section);
      const params = new URLSearchParams(searchParams.toString());
      params.set('section', section);
      router.replace(`/admin?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const ActivePanel = PANELS[active];

  return (
    <AdminShell active={active} onChange={handleChange}>
      <ActivePanel />
    </AdminShell>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageInner />
    </Suspense>
  );
}
