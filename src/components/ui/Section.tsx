import type { ElementType, ReactNode } from "react";

/** Consistent vertical rhythm + centred max-width container. */
export function Section({
  children,
  as: Tag = "section",
  id,
  className = "",
  container = true,
}: {
  children: ReactNode;
  as?: ElementType;
  id?: string;
  className?: string;
  container?: boolean;
}) {
  return (
    <Tag id={id} className={`relative py-16 sm:py-20 lg:py-28 ${className}`}>
      {container ? <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">{children}</div> : children}
    </Tag>
  );
}
