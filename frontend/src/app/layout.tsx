import type { Metadata } from 'next';
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-white">
        {children}
      </body>
    </html>
  );
}
