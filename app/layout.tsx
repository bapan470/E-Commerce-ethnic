import './globals.css';
import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import Providers from '@/components/providers';
import { getServerSupabase } from '@/lib/supabase-server';
import { SeoSettings } from '@/lib/marketing-api';

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://saaj.example';

const DEFAULT_SEO: SeoSettings = {
  site_title: 'Saaj — Handwoven Indian Ethnic Wear & Sarees',
  meta_description:
    'Discover handpicked sarees, lehengas and ethnic wear from master weavers across India. Timeless craftsmanship, modern convenience.',
  keywords:
    'saree, ethnic wear, Indian boutique, handwoven sarees, lehenga, silk saree, banarasi, kanjivaram, bridal saree',
  og_image: '',
  google_site_verification: '',
};

// Reads Admin > Marketing > SEO settings (falls back to sensible defaults
// if nothing has been saved yet, or if Supabase is briefly unreachable).
async function getSeoSettings(): Promise<SeoSettings> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'seo_settings')
      .maybeSingle();
    return { ...DEFAULT_SEO, ...((data?.value as Partial<SeoSettings>) || {}) };
  } catch {
    return DEFAULT_SEO;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  const keywords = seo.keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: seo.site_title,
      template: '%s | Saaj Boutique',
    },
    description: seo.meta_description,
    keywords,
    alternates: {
      canonical: '/',
    },
    openGraph: {
      title: seo.site_title,
      description: seo.meta_description,
      siteName: 'Saaj Boutique',
      type: 'website',
      url: SITE_URL,
      images: seo.og_image ? [{ url: seo.og_image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.site_title,
      description: seo.meta_description,
      images: seo.og_image ? [seo.og_image] : undefined,
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
    verification: seo.google_site_verification
      ? { google: seo.google_site_verification }
      : undefined,
  };
}

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
