/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "randomuser.me",
      },
    ],
    domains: ["images.clerk.dev"],
  },
  // Netlify deployment optimizations
  trailingSlash: false,
  // Add a comment with the project name
  // Project: Sensai - The AI Career Coach
};

export default nextConfig;
