/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The voice-note converter (ffmpeg) ships as a binary with the route that uses it.
    serverComponentsExternalPackages: ['ffmpeg-static'],
    outputFileTracingIncludes: { '/api/products/media': ['./node_modules/ffmpeg-static/ffmpeg'], '/api/whatsapp/conversations/[id]/media': ['./node_modules/ffmpeg-static/ffmpeg'], '/api/whatsapp/media/[id]': ['./node_modules/ffmpeg-static/ffmpeg'] },
  },
  // Lets a test build run in another folder while the dev server uses .next
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    domains: ['images.unsplash.com', 'res.cloudinary.com', 'lh3.googleusercontent.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
