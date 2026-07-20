"use client";

import { useState } from 'react';
import AdminShell, { type AdminSection } from '@/components/admin/admin-shell';
import ProductsPanel from '@/components/admin/products-panel';
import OrdersPanel from '@/components/admin/orders-panel';
import CategoriesPanel from '@/components/admin/categories-panel';
import VariantsPanel from '@/components/admin/variants-panel';
import ReviewsPanel from '@/components/admin/reviews-panel';
import CouponsPanel from '@/components/admin/coupons-panel';
import SettingsPanel from '@/components/admin/settings-panel';
import ReturnsPanel from '@/components/admin/returns-panel';
import SupportTicketsPanel from '@/components/admin/support-tickets-panel';
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

const PANELS: Record<AdminSection, React.ComponentType> = {
  analytics: AnalyticsPanel,
  products: ProductsPanel,
  variants: VariantsPanel,
  categories: CategoriesPanel,
  reviews: ReviewsPanel,
  orders: OrdersPanel,
  customers: CustomersPanel,
  returns: ReturnsPanel,
  'support-tickets': SupportTicketsPanel,
  'abandoned-carts': AbandonedCartsPanel,
  'restock-alerts': StockNotificationsPanel,
  wholesale: WholesalePanel,
  coupons: CouponsPanel,
  marketing: MarketingPanel,
  loyalty: LoyaltyPanel,
  referrals: ReferralsPanel,
  resellers: ResellersPanel,
  giftcards: GiftCardsPanel,
  settings: SettingsPanel,
};

export default function AdminPage() {
  const [active, setActive] = useState<AdminSection>('analytics');
  const ActivePanel = PANELS[active];

  return (
    <AdminShell active={active} onChange={setActive}>
      <ActivePanel />
    </AdminShell>
  );
}
