import './global.css';
import { Providers } from '@/components/providers';

export const metadata = {
  title: 'Quantyx',
  description: 'Event analytics platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
