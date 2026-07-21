/**
 * Concentric sonar / scan rings — a recurring "locate" motif that reinforces
 * the recovery-ops feel. Decorative only.
 */
export function SonarRings({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <circle cx="100" cy="100" r="30" opacity="0.9" />
        <circle cx="100" cy="100" r="55" opacity="0.5" />
        <circle cx="100" cy="100" r="80" opacity="0.28" />
        <circle cx="100" cy="100" r="99" opacity="0.14" />
      </g>
      <line x1="100" y1="4" x2="100" y2="196" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="4" y1="100" x2="196" y2="100" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <circle cx="100" cy="100" r="2.5" fill="currentColor" />
    </svg>
  );
}
