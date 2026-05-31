import type { Metadata } from "next";
import "@/styles/globals.css";
import { Web3AuthProvider } from "@/providers/Web3AuthProvider";
import { WagmiProvider } from "@/providers/WagmiProvider";
import { ZamaProvider } from "@/providers/ZamaProvider";
import { RoleProvider } from "@/providers/RoleProvider";

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
        <Web3AuthProvider>
          <WagmiProvider>
            <ZamaProvider>
              <RoleProvider>
                {children}
              </RoleProvider>
            </ZamaProvider>
          </WagmiProvider>
        </Web3AuthProvider>
      </body>
    </html>
  );
}
