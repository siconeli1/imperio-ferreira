"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CustomerAccountBar() {
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/minha-conta" || pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <header className="border-b border-white/10 bg-black/30 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-semibold uppercase tracking-[0.16em] text-white">
          Imperio Ferreira
        </Link>
      </div>
    </header>
  );
}
