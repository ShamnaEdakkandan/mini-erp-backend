/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/api/:path*/",
        destination: `${(process.env.DJANGO_API_ORIGIN || "http://127.0.0.1:8000").replace(/\/+$/, "")}/api/:path*/`,
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
