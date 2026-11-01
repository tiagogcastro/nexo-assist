import type { Metadata } from 'next';
import { IBM_Plex_Mono, Newsreader, Schibsted_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/layout/Providers';

const ui = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });
const display = Newsreader({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const data = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-data',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Nexo Assist',
  description: 'Service desk de TI com atendimento inteligente e suporte humano.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${ui.variable} ${display.variable} ${data.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
