/*
 * @file page.tsx
 * @description Dynamic page route wrapper for /verify/[invoiceId] that disables SSR.
 */

import dynamic from "next/dynamic";

const VerifyClient = dynamic(() => import("./VerifyClient"), {
  ssr: false,
});

interface VerifyPageProps {
  params: {
    invoiceId: string;
  };
}

export default function VerifyPage({ params }: VerifyPageProps) {
  return <VerifyClient invoiceId={BigInt(params.invoiceId)} />;
}
