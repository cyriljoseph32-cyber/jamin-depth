/**
 * Subtle underwater light caustics rendered from SVG turbulence.
 * Slow drift; frozen entirely under prefers-reduced-motion (see globals.css).
 */
export function Caustics() {
  return (
    <div className="absolute inset-x-0 top-0 h-[60vh] overflow-hidden opacity-60">
      <svg
        className="caustics h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <filter id="caustic-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.05"
              numOctaves="2"
              seed="7"
              result="n"
            />
            <feColorMatrix
              in="n"
              type="matrix"
              values="0 0 0 0 0.07
                      0 0 0 0 0.30
                      0 0 0 0 0.35
                      0 0 0 0.9 0"
            />
            <feComponentTransfer>
              <feFuncA type="gamma" amplitude="1" exponent="3" offset="0" />
            </feComponentTransfer>
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#caustic-noise)" />
      </svg>
    </div>
  );
}
