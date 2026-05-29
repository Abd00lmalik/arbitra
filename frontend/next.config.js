/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
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
   * Using credentialless (not require-corp) to maintain WalletConnect compatibility.
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
  webpack(config, { isServer }) {
    /* Required for Zama SDK WASM: disable Node.js-only modules in the browser */
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    /* Required: enable async WASM loading for @zama-fhe/relayer-sdk */
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    /* Ensure WASM files from node_modules are bundled as assets */
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    config.resolve.alias = {
      ...config.resolve.alias,
      unstorage: require.resolve("unstorage"),
    };
    return config;
  },
};

module.exports = nextConfig;
