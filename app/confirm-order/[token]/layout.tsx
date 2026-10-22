import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Confirm your order',
  robots: { index: false, follow: false },
};

export default function ConfirmOrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
