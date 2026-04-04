import './global.css';
import type { Metadata } from 'next';
import {
  Instrument_Sans,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
} from 'next/font/google';
import { Providers } from '@/components/providers';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
  display: 'swap',
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Quantyx',
    template: '%s | Quantyx',
  },
  description:
    'Event analytics platform for tracking user behavior, page views, and custom events.',
  metadataBase: new URL(
    process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000',
  ),
  openGraph: {
    title: 'Quantyx',
    description:
      'Event analytics platform for tracking user behavior, page views, and custom events.',
    siteName: 'Quantyx',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quantyx',
    description:
      'Event analytics platform for tracking user behavior, page views, and custom events.',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${instrumentSans.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
