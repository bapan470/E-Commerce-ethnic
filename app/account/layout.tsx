import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase-server-auth';
import AccountNav from '@/components/account/account-nav';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account');

  return (
    <div className="container-boutique grid gap-8 py-10 md:grid-cols-[220px_1fr]">
      <aside className="space-y-1">
        <div className="mb-4 px-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Welcome back</p>
          <p className="truncate font-serif text-lg font-semibold text-primary">{user.email}</p>
        </div>
        <AccountNav />
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
