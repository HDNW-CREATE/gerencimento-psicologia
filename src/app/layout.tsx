import type { Metadata, Viewport } from 'next';
import { Inter, Lora } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Lora({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: { default: 'Consultório de Psicologia', template: '%s | Consultório de Psicologia' },
  description: 'Psicoterapia individual e de casal, presencial e online.',
  applicationName: 'Consultório',
  appleWebApp: { capable: true, title: 'Consultório', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#3f6554',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2"
        >
          Pular para o conteúdo
        </a>
        {children}
        <Toaster position="top-center" richColors closeButton />
        <script
          // Registra o service worker (PWA) apenas em produção
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator && location.protocol === 'https:') { window.addEventListener('load', function(){ navigator.serviceWorker.register('/sw.js').catch(function(){}); }); }`,
          }}
        />
      </body>
    </html>
  );
}
