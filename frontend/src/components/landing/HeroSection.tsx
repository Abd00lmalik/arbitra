/**
 * @file HeroSection.tsx
 * @description Cinematic hero section with word-by-word entry animations, floating lock/shield particles, and nav header.
 */

"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";

interface Particle {
  top: string;
  left: string;
  size: number;
  dur: number;
  delay: number;
  type: "lock" | "shield";
}

const PARTICLES: Particle[] = [
  { top: "8%",  left: "6%",  size: 18, dur: 8,  delay: 0,   type: "lock"   },
  { top: "12%", left: "88%", size: 14, dur: 11, delay: 1.5, type: "shield" },
  { top: "22%", left: "4%",  size: 12, dur: 9,  delay: 2,   type: "shield" },
  { top: "18%", left: "92%", size: 16, dur: 13, delay: 0.5, type: "lock"   },
  { top: "38%", left: "2%",  size: 11, dur: 7,  delay: 3,   type: "lock"   },
  { top: "45%", left: "95%", size: 13, dur: 10, delay: 1,   type: "shield" },
  { top: "60%", left: "5%",  size: 15, dur: 12, delay: 2.5, type: "lock"   },
  { top: "55%", left: "90%", size: 12, dur: 8,  delay: 4,   type: "shield" },
  { top: "72%", left: "8%",  size: 10, dur: 14, delay: 0.8, type: "lock"   },
  { top: "78%", left: "85%", size: 14, dur: 9,  delay: 3.5, type: "lock"   },
  { top: "85%", left: "12%", size: 12, dur: 11, delay: 1.2, type: "shield" },
  { top: "82%", left: "80%", size: 11, dur: 7,  delay: 2.2, type: "shield" },
  { top: "30%", left: "15%", size: 8,  dur: 10, delay: 5,   type: "lock"   },
  { top: "35%", left: "80%", size: 9,  dur: 6,  delay: 4.5, type: "shield" },
  { top: "65%", left: "75%", size: 10, dur: 13, delay: 1.8, type: "lock"   },
  { top: "20%", left: "50%", size: 7,  dur: 8,  delay: 3.2, type: "shield" },
  { top: "90%", left: "45%", size: 8,  dur: 9,  delay: 2.8, type: "lock"   },
  { top: "5%",  left: "45%", size: 9,  dur: 11, delay: 0.3, type: "shield" }
];

function LockIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="rgba(123,47,255,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const HEADLINE_WORDS = ["Invoice", "Factoring,", "Fully", "Confidential."];

const wordVariants = {
  hidden: { opacity: 0, y: 40, filter: "blur(8px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }
  })
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay: 0.5 + i * 0.12, ease: [0.16, 1, 0.3, 1] }
  })
};

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const headlineY = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const particlesY = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <section
      ref={containerRef}
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        zIndex: 1,
        overflow: "hidden"
      }}
    >
      {/* ── Gradient orbs ── */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{
          position: "absolute", top: "-10%", left: "-5%",
          width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,240,255,0.12) 0%, transparent 65%)",
          animation: "blob 22s ease-in-out infinite"
        }} />
        <div style={{
          position: "absolute", top: "-5%", right: "-8%",
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(123,47,255,0.10) 0%, transparent 65%)",
          animation: "blob 28s ease-in-out infinite reverse 4s"
        }} />
        <div style={{
          position: "absolute", bottom: "5%", left: "35%",
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,255,136,0.07) 0%, transparent 65%)",
          animation: "blob 18s ease-in-out infinite 8s"
        }} />
      </div>

      {/* ── Floating particles ── */}
      <motion.div
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none", y: particlesY }}
      >
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: p.top,
              left: p.left,
              opacity: 0.14 + (i % 3) * 0.04,
              animation: `float-${i % 6} ${p.dur}s ease-in-out ${p.delay}s infinite alternate`
            }}
          >
            {p.type === "lock" ? <LockIcon size={p.size} /> : <ShieldIcon size={p.size} />}
          </div>
        ))}
        <style>{`
          @keyframes float-0 { to { transform: translateY(-12px) rotate(3deg); } }
          @keyframes float-1 { to { transform: translateY(-8px)  rotate(-4deg); } }
          @keyframes float-2 { to { transform: translateY(-16px) rotate(2deg); } }
          @keyframes float-3 { to { transform: translateY(-10px) rotate(-2deg); } }
          @keyframes float-4 { to { transform: translateY(-14px) rotate(5deg); } }
          @keyframes float-5 { to { transform: translateY(-7px)  rotate(-3deg); } }
          @keyframes blob {
            0%,100% { transform: translate(0,0) scale(1); }
            33%     { transform: translate(15px,-20px) scale(1.05); }
            66%     { transform: translate(-10px,12px) scale(0.96); }
          }
        `}</style>
      </motion.div>

      {/* ── Navigation ── */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 32px",
          background: "rgba(2,7,20,0.75)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)"
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #00F0FF, #7B2FFF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 17, color: "#020714",
            fontFamily: "Satoshi, sans-serif",
            boxShadow: "0 0 20px rgba(0,240,255,0.3)"
          }}>A</div>
          <span style={{
            fontFamily: "Satoshi, sans-serif",
            fontWeight: 800, fontSize: 19, color: "#EEF2FF"
          }}>Arbitra</span>
          <span style={{
            background: "rgba(0,240,255,0.08)",
            border: "1px solid rgba(0,240,255,0.22)",
            borderRadius: 100,
            padding: "3px 10px",
            fontSize: 11, fontWeight: 600,
            color: "#00F0FF",
            fontFamily: "Satoshi, sans-serif",
            letterSpacing: "0.05em"
          }}>Sepolia Testnet</span>
        </div>

        {/* Nav actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="https://faucet.zama.ai"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#8B9CC8",
              fontSize: "14px",
              fontWeight: 500,
              textDecoration: "none",
              fontFamily: "Satoshi, sans-serif",
              transition: "color 0.2s"
            }}
          >
            Get Test cUSDT
          </a>
          <Link href="/marketplace" style={{
            color: "#8B9CC8", fontSize: 14, fontWeight: 500, textDecoration: "none",
            fontFamily: "Satoshi, sans-serif",
            transition: "color 0.2s"
          }}>Marketplace</Link>
          <Link href="/dashboard" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            height: 40, padding: "0 20px",
            background: "rgba(0,240,255,0.08)",
            border: "1.5px solid rgba(0,240,255,0.3)",
            borderRadius: 12,
            color: "#00F0FF", fontSize: 14, fontWeight: 600,
            textDecoration: "none",
            fontFamily: "Satoshi, sans-serif",
            transition: "all 0.2s"
          }}>Launch App</Link>
        </div>
      </motion.nav>

      {/* ── Hero body ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "80px 24px 100px",
        position: "relative",
        zIndex: 2
      }}>
        <motion.div style={{ y: headlineY }}>
          {/* Eyebrow label */}
          <motion.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(0,240,255,0.06)",
              border: "1px solid rgba(0,240,255,0.2)",
              borderRadius: 100,
              padding: "6px 16px",
              marginBottom: 36,
              fontSize: 13,
              fontWeight: 600,
              color: "#00F0FF",
              fontFamily: "Satoshi, sans-serif",
              letterSpacing: "0.04em"
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "#00F0FF",
              boxShadow: "0 0 8px #00F0FF",
              animation: "pulse 2s ease-in-out infinite",
              display: "inline-block"
            }} />
            Powered by Zama FHEVM · Private RWA Protocol
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
          </motion.div>

          {/* Main headline - word by word */}
          <h1 style={{
            fontFamily: "Satoshi, sans-serif",
            fontWeight: 900,
            fontSize: "clamp(40px, 7vw, 76px)",
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: "#EEF2FF",
            margin: "0 0 28px",
            maxWidth: 860
          }}>
            {HEADLINE_WORDS.map((word, i) => (
              <motion.span
                key={word}
                custom={i}
                variants={wordVariants}
                initial="hidden"
                animate="visible"
                style={{
                  display: "inline-block",
                  marginRight: "0.28em",
                  color: word === "Confidential." ? "transparent" : "#EEF2FF",
                  backgroundImage: word === "Confidential."
                    ? "linear-gradient(135deg, #00F0FF 0%, #7B2FFF 100%)"
                    : "none",
                  WebkitBackgroundClip: word === "Confidential." ? "text" : "unset",
                  backgroundClip: word === "Confidential." ? "text" : "unset"
                }}
              >
                {word}
              </motion.span>
            ))}
          </h1>

          {/* Subheadline */}
          <motion.p
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            style={{
              fontFamily: "Satoshi, sans-serif",
              fontSize: "clamp(16px, 2vw, 19px)",
              lineHeight: 1.75,
              color: "#8B9CC8",
              maxWidth: 580,
              margin: "0 auto 44px"
            }}
          >
            Suppliers tokenize invoices as encrypted RWAs. Investors assess risk
            via Gemini AI and factor them onchain - all financial data protected
            by Fully Homomorphic Encryption. Zero plaintext, ever.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}
          >
            <Link href="/dashboard" style={{ textDecoration: "none" }}>
              <motion.span
                whileHover={{ scale: 1.04, boxShadow: "0 0 34px rgba(0,240,255,0.45)" }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 54,
                  padding: "0 32px",
                  background: "#00F0FF",
                  color: "#020714",
                  borderRadius: 14,
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: "Satoshi, sans-serif",
                  cursor: "pointer",
                  boxShadow: "0 0 20px rgba(0,240,255,0.25)",
                  transition: "box-shadow 0.2s"
                }}
              >
                Launch App
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M8 3l5 5-5 5" stroke="#020714" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.span>
            </Link>
            <Link href="/marketplace" style={{ textDecoration: "none" }}>
              <motion.span
                whileHover={{ scale: 1.03, background: "rgba(0,240,255,0.08)" }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 54,
                  padding: "0 32px",
                  background: "transparent",
                  border: "1.5px solid rgba(0,240,255,0.32)",
                  color: "#00F0FF",
                  borderRadius: 14,
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "Satoshi, sans-serif",
                  cursor: "pointer",
                  transition: "background 0.2s"
                }}
              >
                Browse Marketplace
              </motion.span>
            </Link>
          </motion.div>

          {/* Trust micro-badges */}
          <motion.div
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: 32
            }}
          >
            {[
              { icon: "lock", label: "Zama FHEVM" },
              { icon: "layers", label: "ERC-7984" },
              { icon: "cpu", label: "Sepolia Testnet" },
              { icon: "stars", label: "Gemini AI" },
              { icon: "shield", label: "Zero Plaintext" }
            ].map(({ icon, label }) => (
              <div key={label} style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 100,
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 600,
                color: "#8B9CC8",
                fontFamily: "Satoshi, sans-serif",
                letterSpacing: "0.06em"
              }}>
                <IconByName name={icon} />
                {label}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* ── Scroll indicator ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          zIndex: 2
        }}
      >
        <span style={{ color: "#3D4E7A", fontSize: 11, fontFamily: "Satoshi, sans-serif", letterSpacing: "0.1em" }}>
          SCROLL
        </span>
        <div style={{
          width: 24, height: 40,
          border: "1.5px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          display: "flex",
          justifyContent: "center",
          paddingTop: 6
        }}>
          <div style={{
            width: 4, height: 8, borderRadius: 2,
            background: "#00F0FF",
            animation: "scrollDot 2s ease-in-out infinite"
          }} />
        </div>
        <style>{`
          @keyframes scrollDot {
            0%   { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(14px); opacity: 0; }
          }
        `}</style>
      </motion.div>
    </section>
  );
}

function IconByName({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    lock: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    layers: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    cpu: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2.5"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>,
    stars: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    shield: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  };
  return icons[name] || null;
}
