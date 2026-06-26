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
    outputFileTracingIncludes: {
      "/api/compliance-store": [
        "./node_modules/@zama-fhe/relayer-sdk/lib/tfhe_bg.wasm",
        "./node_modules/@zama-fhe/relayer-sdk/lib/kms_lib_bg.wasm",
        "./node_modules/node-tfhe/**/*",
        "./node_modules/node-tkms/**/*",
      ],
      "/api/parse-invoice": [
        "./node_modules/pdf-parse/**/*",
        "./node_modules/pdfjs-dist/**/*",
        "./node_modules/@napi-rs/canvas/**/*",
        "./node_modules/tesseract.js/**/*",
        "./node_modules/tesseract.js-core/**/*",
        "./node_modules/@tesseract.js-data/eng/**/*",
      ],
    },
    serverComponentsExternalPackages: [
      "@zama-fhe/relayer-sdk",
      "node-tfhe",
      "node-tkms",
    ],
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

    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { message: /Circular dependency between chunks with runtime/ },
    ];

    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      unstorage: require.resolve("unstorage"),
    };
    return config;
  },
};

module.exports = nextConfig;
