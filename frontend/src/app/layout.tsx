import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';

export const metadata: Metadata = {
  title: 'Qualitet Market',
  description: 'Futuristic B2B/B2C Marketplace Platform',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className="dark">
      <body className="bg-[#0a0a0f] text-white min-h-screen font-sans">
        <Header />
        <main className="pb-24 min-h-screen">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
