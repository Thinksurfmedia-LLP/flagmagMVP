/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        allowedOrigins: ['192.168.1.74', 'localhost:3000']
    },
    // The console said `allowedDevOrigins` directly on module.exports but let's be safe and just add it directly as the console says:
    allowedDevOrigins: ['192.168.1.74'],
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
