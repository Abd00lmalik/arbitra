"use client";

/**
 * FaucetLinks — direct outbound links for test token acquisition.
 * No modals. No wrapping. No cUSDC. Just clean anchor links.
 * Payment token: Standard ERC-20 USDC on Sepolia.
 */
export function FaucetLinks() {
  return (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
      <a
        href="https://faucet.circle.com/"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display:        "inline-flex",
          alignItems:     "center",
          gap:            7,
          background:     "rgba(0,240,255,0.08)",
          border:         "1px solid rgba(0,240,255,0.25)",
          borderRadius:   10,
          padding:        "9px 16px",
          color:          "#00F0FF",
          fontSize:       12,
          fontWeight:     600,
          fontFamily:     "Satoshi, sans-serif",
          textDecoration: "none",
          whiteSpace:     "nowrap",
        }}
      >
        <DropletIcon />
        Get Test USDC (Circle Faucet) ↗
      </a>
      <a
        href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display:        "inline-flex",
          alignItems:     "center",
          gap:            7,
          background:     "rgba(255,255,255,0.04)",
          border:         "1px solid rgba(255,255,255,0.10)",
          borderRadius:   10,
          padding:        "9px 16px",
          color:          "#8B9CC8",
          fontSize:       12,
          fontWeight:     600,
          fontFamily:     "Satoshi, sans-serif",
          textDecoration: "none",
          whiteSpace:     "nowrap",
        }}
      >
        <GasIcon />
        Get Sepolia ETH (Gas) ↗
      </a>
    </div>
  );
}

function DropletIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
    </svg>
  );
}

function GasIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 22V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v13"/>
      <path d="M3 22h12M13 9l5 5-5 5"/>
      <path d="M18 14h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1"/>
    </svg>
  );
}
