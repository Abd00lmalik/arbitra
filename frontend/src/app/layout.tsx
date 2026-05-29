import type { Metadata } from "next";
import "@/styles/globals.css";
import { WagmiProvider } from "@/providers/WagmiProvider";
import { ZamaProvider } from "@/providers/ZamaProvider";

export const metadata: Metadata = {
  title: "Arbitra — Confidential Invoice Factoring",
  description:
    "Decentralized confidential invoice factoring registry powered by Zama FHEVM. Submit and trade invoices with fully homomorphic encryption protecting all financial data.",
  keywords: [
    "invoice factoring",
    "FHE",
    "FHEVM",
    "Zama",
    "DeFi",
    "confidential",
    "blockchain",
    "Sepolia",
  ],
  openGraph: {
    title: "Arbitra — Confidential Invoice Factoring",
    description:
      "FHE-powered decentralized invoice factoring on Ethereum. Zero-knowledge financial data.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-navy-900 text-white antialiased">
        <WagmiProvider>
          <ZamaProvider>{children}</ZamaProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
