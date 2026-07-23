/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_FLARE_RPC_URL: process.env.NEXT_PUBLIC_FLARE_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc",
  },
};

module.exports = nextConfig;
