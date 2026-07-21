import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-mono text-xs sm:text-sm uppercase tracking-[0.14em] font-medium transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none select-none";

const sizes: Record<Size, string> = {
  md: "px-5 py-3",
  lg: "px-7 py-4",
};

const variants: Record<Variant, string> = {
  primary: "bg-signal text-ink hover:bg-signal-600",
  outline: "border border-foam/30 text-foam hover:border-signal hover:text-signal",
  ghost: "text-foam-dim hover:text-foam",
};

function classes(variant: Variant, size: Size, className = "") {
  return `${base} ${sizes[size]} ${variants[variant]} ${className}`;
}

interface CommonProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

/** Internal link button (Next <Link>). */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: CommonProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const isExternal = /^https?:|^tel:|^mailto:/.test(href);
  if (isExternal) {
    const external = href.startsWith("http");
    return (
      <a
        href={href}
        className={classes(variant, size, className)}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...rest}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

/** Real <button> for form actions. */
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={classes(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}
