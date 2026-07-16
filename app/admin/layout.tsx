import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Panel',
  description: 'Manage products, inventory, and orders.',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
