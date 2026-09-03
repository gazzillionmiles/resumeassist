import './globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'Outreach — Tailored Job Outreach & Company Research',
  description: 'Grounded company research, intelligence synthesis, and hyper-tailored outreach for email & LinkedIn.',
  icons: {
    icon: '/Outreach.png',
    shortcut: '/Outreach.png',
    apple: '/Outreach.png',
  },
  openGraph: {
    title: 'Outreach — Tailored Job Outreach & Company Research',
    description: 'Grounded company research, intelligence synthesis, and hyper-tailored outreach for email & LinkedIn.',
    images: [{ url: '/Outreach.png', width: 512, height: 512, alt: 'Outreach Logo' }],
  },
  twitter: {
    card: 'summary',
    title: 'Outreach — Tailored Job Outreach & Company Research',
    description: 'Grounded company research, intelligence synthesis, and hyper-tailored outreach for email & LinkedIn.',
    images: ['/Outreach.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#121316] text-[#F4F4F5] antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
