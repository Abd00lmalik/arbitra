/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@reown/appkit",
    "@reown/appkit-utils",
    "@reown/appkit-controllers",
    "@walletconnect/universal-provider",
    "@walletconnect/core",
    "@walletconnect/sign-client",
    "@walletconnect/ethereum-provider",
    "unstorage"
  ],
  experimental: {
    esmExternals: "loose",
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  /*
   * FHEVM SDK requires SharedArrayBuffer which needs COOP + COEP headers.
   * Using credentialless (not require-corp) to keep wagmi/WalletConnect working.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
  webpack(config) {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    config.resolve.alias = {
      ...config.resolve.alias,
      unstorage: require.resolve("unstorage"),
    };
    return config;
  },
};

module.exports = nextConfig;
