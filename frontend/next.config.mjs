/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  devIndicators: false,
  experimental: {
    serverActions: {
      // Las subidas de adjuntos pasan por Server Actions (BFF). Igual al tope
      // duro de multer en NestJS (ADJUNTO_HARD_LIMIT_BYTES = 100 MB); el máximo
      // efectivo por archivo lo fija la plaza (configuracion, default 50 MB).
      bodySizeLimit: '100mb',
    },
  },
  reactStrictMode: true,
  poweredByHeader: false,
  // Variables de entorno expuestas al cliente
  env: {
    NEXT_PUBLIC_APP_NAME: 'Plazapp',
  },
  // En producción, el host del backend
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
