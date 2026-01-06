/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ hostname: "tough-canary-303.convex.cloud" }],
  },
   typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
