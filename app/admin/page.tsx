"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ProductsPanel from '@/components/admin/products-panel';
import OrdersPanel from '@/components/admin/orders-panel';
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

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductsPanel />
        </TabsContent>

        <TabsContent value="orders">
          <OrdersPanel />
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

