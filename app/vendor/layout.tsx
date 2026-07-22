import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/supabase-server-auth';

const NAV = [
  { href: '/vendor/dashboard', label: 'Dashboard' },
  { href: '/vendor/dashboard/add-product', label: 'Add Product' },
  { href: '/vendor/dashboard/orders', label: 'My Orders' },
  { href: '/vendor/dashboard/earnings', label: 'Earnings' },
  { href: '/vendor/dashboard/kyc', label: 'KYC Documents' },
];

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/vendor/dashboard');

  return (
    <div className="container-boutique max-w-3xl py-10 sm:py-14">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Vendor Sourcing</p>
      <nav className="mb-6 flex flex-wrap gap-4 border-b border-border/60 pb-3 text-sm">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="font-medium text-muted-foreground hover:text-primary">
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
