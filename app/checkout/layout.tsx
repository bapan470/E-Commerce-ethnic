import { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://saaj.example';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete your purchase securely with Razorpay payment.',
  alternates: {
    canonical: `${SITE_URL}/checkout`,
  },
  robots: { index: false, follow: true },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
