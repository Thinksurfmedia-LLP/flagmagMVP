/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/assets/images/uploads/:filename",
        destination: "/api/uploads/:filename",
      },
    ];
  },
};

export default nextConfig;
