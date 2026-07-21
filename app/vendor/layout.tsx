import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase-server-auth';

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/vendor/dashboard');

  return (
    <div className="container-boutique max-w-3xl py-10 sm:py-14">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Vendor Sourcing</p>
      {children}
    </div>
  );
}
