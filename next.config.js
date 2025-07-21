/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['eaeulxmxiwnxopnjrvun.supabase.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'eaeulxmxiwnxopnjrvun.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig 