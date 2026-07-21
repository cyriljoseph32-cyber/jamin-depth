/** Mono uppercase label — the technical "recovery-ops" microtype. */
export function Kicker({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`mono-kicker inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden className="h-px w-6 bg-signal/70" />
      {children}
    </span>
  );
}
