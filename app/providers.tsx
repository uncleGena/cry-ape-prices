"use client";

import type { PropsWithChildren } from "react";
import { IconContext } from "react-icons";

/**
 * Binds react-icons defaults so all icons share the same styling defaults.
 */
export function Providers({ children }: PropsWithChildren) {
  return (
    <IconContext.Provider value={{ className: "text-2xl" }}>
      {children}
    </IconContext.Provider>
  );
}