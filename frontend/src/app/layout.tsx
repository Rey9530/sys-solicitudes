import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Plazapp',
    template: '%s · Plazapp',
  },
  description: 'Plataforma de gestión de solicitudes para centros comerciales',
  applicationName: 'Plazapp',
  authors: [{ name: 'Helixsys' }],
  generator: 'Next.js',
  robots: { index: false, follow: false },
};

// Fija `data-theme` antes del primer paint para evitar flash (FOUC) al cambiar
// de tema. Respeta la preferencia guardada y, en su defecto, la del sistema.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen">
        <div id="app-root">{children}</div>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
