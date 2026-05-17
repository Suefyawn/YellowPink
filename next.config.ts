import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // Image optimisation: allow Supabase Storage + the WP source host (set
  // WP_IMAGE_HOST in env if your Woo images live somewhere else).
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Supabase Storage on the configured project.
      ...(supabaseHost ? [{ protocol: 'https' as const, hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }] : []),
      // Allow the WP origin (until media migration is done).
      ...(process.env.WP_IMAGE_HOST ? [{ protocol: 'https' as const, hostname: process.env.WP_IMAGE_HOST }] : []),
      // Common CDNs people host product imagery on.
      { protocol: 'https' as const, hostname: 'images.unsplash.com' },
      { protocol: 'https' as const, hostname: 'res.cloudinary.com' },
    ],
  },
  // Edge compression.
  compress: true,
};

export default nextConfig;
