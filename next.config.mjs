/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async rewrites() {
    return {
      // beforeFiles: uploads written to public/ at runtime must always go
      // through /api/uploads (which adds nosniff + an SVG sandbox CSP), even
      // when a matching file exists on disk and would otherwise be served raw.
      beforeFiles: [
        {
          source: "/assets/images/uploads/:filename",
          destination: "/api/uploads/:filename",
        },
      ],
    };
  },
};

export default nextConfig;
