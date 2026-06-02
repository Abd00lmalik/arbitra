"use client";

export function LockedPage({ message }: { message: string }) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        textAlign: "center",
        padding: "40px 24px",
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: "rgba(255,186,0,0.08)",
          border: "2px solid rgba(255,186,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFBA00" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div>
        <h2
          style={{
            color: "#FFBA00",
            fontSize: 20,
            fontWeight: 800,
            fontFamily: "Satoshi,sans-serif",
            marginBottom: 8,
          }}
        >
          Marketplace Locked
        </h2>
        <p
          style={{
            color: "#8B9CC8",
            fontSize: 14,
            fontFamily: "Satoshi,sans-serif",
            maxWidth: 400,
          }}
        >
          {message}
        </p>
      </div>
      <a
        href="/register"
        style={{
          background: "#FFBA00",
          color: "#020714",
          borderRadius: 12,
          padding: "11px 24px",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "Satoshi,sans-serif",
          textDecoration: "none",
        }}
      >
        Complete Verification {"\u2192"}
      </a>
    </div>
  );
}
