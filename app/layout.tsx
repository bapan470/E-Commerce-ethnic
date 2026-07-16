import './globals.css';
import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import Providers from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://saaj.example'),
  title: {
    default: 'Saaj — Handwoven Indian Ethnic Wear & Sarees',
    template: '%s | Saaj Boutique',
  },
  description:
    'Discover handpicked sarees, lehengas and ethnic wear from master weavers across India. Timeless craftsmanship, modern convenience.',
  keywords: [
    'saree',
    'ethnic wear',
    'Indian boutique',
    'handwoven sarees',
    'lehenga',
    'silk saree',
    'banarasi',
    'kanjivaram',
    'bridal saree',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Saaj — Handwoven Indian Ethnic Wear',
    description:
      'Handpicked sarees and ethnic wear from master weavers across India.',
    siteName: 'Saaj Boutique',
    type: 'website',
    url: 'https://saaj.example',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Saaj — Handwoven Indian Ethnic Wear',
    description:
      'Handpicked sarees and ethnic wear from master weavers across India.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
