import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Regintels',
  description: 'Regulatory Intelligence Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
