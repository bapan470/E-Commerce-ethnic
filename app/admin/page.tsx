"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ProductsPanel from '@/components/admin/products-panel';
import OrdersPanel from '@/components/admin/orders-panel';
import CategoriesPanel from '@/components/admin/categories-panel';
import VariantsPanel from '@/components/admin/variants-panel';
import ReviewsPanel from '@/components/admin/reviews-panel';
import CouponsPanel from '@/components/admin/coupons-panel';
import SettingsPanel from '@/components/admin/settings-panel';
import ReturnsPanel from '@/components/admin/returns-panel';
import AbandonedCartsPanel from '@/components/admin/abandoned-carts-panel';
import MarketingPanel from '@/components/admin/marketing-panel';
import StockNotificationsPanel from '@/components/admin/stock-notifications-panel';
import AnalyticsPanel from '@/components/admin/analytics-panel';
import CustomersPanel from '@/components/admin/customers-panel';
import WholesalePanel from '@/components/admin/wholesale-panel';
import { toast } from 'sonner';

export default function AdminPage() {
  const router = useRouter();

  return (
    <div className="container-boutique py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Admin</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-primary sm:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage products and orders</p>
        </div>
        <div className="flex items-center gap-2">
          <LogoutButton router={router} />
        </div>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="abandoned-carts">Abandoned Carts</TabsTrigger>
          <TabsTrigger value="restock-alerts">Restock Alerts</TabsTrigger>
          <TabsTrigger value="wholesale">Wholesale</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <AnalyticsPanel />
        </TabsContent>

        <TabsContent value="products">
          <ProductsPanel />
        </TabsContent>

        <TabsContent value="variants">
          <VariantsPanel />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesPanel />
        </TabsContent>

        <TabsContent value="reviews">
          <ReviewsPanel />
        </TabsContent>

        <TabsContent value="orders">
          <OrdersPanel />
        </TabsContent>

        <TabsContent value="customers">
          <CustomersPanel />
        </TabsContent>

        <TabsContent value="returns">
          <ReturnsPanel />
        </TabsContent>

        <TabsContent value="abandoned-carts">
          <AbandonedCartsPanel />
        </TabsContent>

        <TabsContent value="restock-alerts">
          <StockNotificationsPanel />
        </TabsContent>

        <TabsContent value="wholesale">
          <WholesalePanel />
        </TabsContent>

        <TabsContent value="coupons">
          <CouponsPanel />
        </TabsContent>

        <TabsContent value="marketing">
          <MarketingPanel />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LogoutButton({ router }: { router: ReturnType<typeof useRouter> }) {
  const handle = async () => {
    try {
      const res = await fetch('/api/admin/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/');
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error || 'Logout failed');
      }
    } catch (err) {
      toast.error('Logout failed');
    }
  };
  return (
    <Button onClick={handle} className="bg-destructive text-destructive-foreground">
      Log out
    </Button>
  );
}

