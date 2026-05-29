interface FHEBadgeProps {
  label?: string;
  size?: "sm" | "md";
  animated?: boolean;
}

export function FHEBadge({
  label = "FHE Encrypted",
  size = "md",
  animated = true,
}: FHEBadgeProps) {
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";

  return (
    <span className={`fhe-badge ${sizeClass} gap-1`}>
      {animated && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse"
          aria-hidden="true"
        />
      )}
      <svg
        className="w-2.5 h-2.5 flex-shrink-0"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M6 1L10 3V6C10 8.5 8.2 10.8 6 11C3.8 10.8 2 8.5 2 6V3L6 1Z"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M4 6L5.5 7.5L8 4.5"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </span>
  );
}
