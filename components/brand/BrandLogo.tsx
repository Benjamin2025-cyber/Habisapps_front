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
      className={cn("flex items-center gap-1.5", className)}
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
    // Plain <img> (next/image isn't used in this project — same pattern as
    // ImageUploadField). The icon is a transparent PNG so it sits on any surface.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo-icon.png"
      alt=""
      aria-hidden="true"
      // `cn` here just joins (no tailwind-merge), so a caller's size must
      // replace the default rather than sit alongside it. Default h-14 w-14
      // (auth screens); callers like the sidebar pass their own size.
      className={cn("object-contain", className || "h-14 w-14")}
    />
  );
}
