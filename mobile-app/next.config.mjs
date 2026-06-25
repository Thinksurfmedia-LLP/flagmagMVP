/** @type {import('next').NextConfig} */
const nextConfig = {
    allowedDevOrigins: ['192.168.1.74', 'localhost:3000'],
    turbopack: {
        root: import.meta.dirname,
    },
    async rewrites() {
        const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:3000";
        return [
            {
                source: "/api/:path*",
                destination: `${apiBaseUrl}/api/:path*`,
            },
            {
                source: "/assets/images/uploads/:path*",
                destination: `${apiBaseUrl}/assets/images/uploads/:path*`,
            },
        ];
    },
};

export default nextConfig;
