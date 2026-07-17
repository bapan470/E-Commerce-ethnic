'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Package, MapPin, User, Heart, RotateCcw, LogOut } from 'lucide-react';

const links = [
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/returns', label: 'Returns & Exchanges', icon: RotateCcw },
  { href: '/account/profile', label: 'Profile', icon: User },
];

export default function AccountNav() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            pathname.startsWith(href)
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
      <button
        onClick={() => signOut()}
        className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </nav>
  );
}
