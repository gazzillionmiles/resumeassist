import './globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  title: 'Outreach — tailored job outreach',
  description: 'Paste a job link, get tailored email and LinkedIn outreach.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
