import { cn } from "@/lib/cn";

type BrandLogoProps = {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
};

export function BrandLogo({
  className,
  iconClassName,
  wordmarkClassName,
}: BrandLogoProps) {
  return (
    <div
      className={cn("flex items-center gap-3", className)}
      aria-label="HabisLoan"
    >
      <BrandMark className={iconClassName} />
      <span
        className={cn(
          "text-3xl font-extrabold tracking-tight leading-none",
          wordmarkClassName,
        )}
      >
        <span className="text-primary">Habis</span>
        <span className="text-accent">Loan</span>
      </span>
    </div>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-10 w-10", className)}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="habis-ring" x1="0" y1="0" x2="64" y2="64">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="50%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#a3158a" />
        </linearGradient>
        <linearGradient id="habis-bird" x1="8" y1="20" x2="56" y2="44">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>

      <circle
        cx="32"
        cy="32"
        r="26"
        fill="none"
        stroke="url(#habis-ring)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="140 40"
      />

      <path
        d="M14 38 Q22 22 32 28 Q40 22 50 26 Q44 34 36 36 Q32 44 22 42 Q18 42 14 38 Z"
        fill="url(#habis-bird)"
      />
      <circle cx="44" cy="28" r="1.6" fill="#0b1020" />
    </svg>
  );
}
