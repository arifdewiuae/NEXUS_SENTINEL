import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dashboard is a pure client of the API (no server actions / route
  // handlers), so it ships as a static export served from S3 + CloudFront.
  output: 'export',
  // The dashboard is a pure client of the verifier API; no server secrets here.
  // The API base URL is injected at build time (the API Gateway URL in production).
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5050',
  },
};

export default nextConfig;
