import dynamic from "next/dynamic";

const PortfolioClient = dynamic(() => import("./PortfolioClient"), {
  ssr: false,
});

export default function PortfolioPage() {
  return <PortfolioClient />;
}
