import { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://saaj.example';

export const metadata: Metadata = {
  title: 'Shop All Sarees & Ethnic Wear',
  description:
    'Browse our full collection of handwoven silk sarees, cotton sarees, lehengas, anarkalis, kurtis and bridal wear. Filter by category, size, and price.',
  alternates: {
    canonical: `${SITE_URL}/shop`,
  },
  openGraph: {
    title: 'Shop All Sarees & Ethnic Wear | Saaj Boutique',
    description:
      'Browse our full collection of handwoven silk sarees, cotton sarees, lehengas, anarkalis, kurtis and bridal wear.',
    url: `${SITE_URL}/shop`,
    siteName: 'Saaj Boutique',
    type: 'website',
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
