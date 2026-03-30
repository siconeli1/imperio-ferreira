"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/agendar", label: "Agendar" },
  { href: "/meus-agendamentos", label: "Meus agendamentos" },
  { href: "/minha-conta", label: "Minha conta" },
];

export function CustomerAccountBar() {
  const pathname = usePathname();

  if (pathname === "/" || pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[rgba(4,7,6,0.88)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="text-base font-semibold uppercase tracking-[0.2em] text-white sm:text-lg">
              Imperio Ferreira
            </Link>
            <Link href="/" className="text-xs uppercase tracking-[0.16em] text-[var(--muted)] hover:text-white sm:hidden">
              Inicio
            </Link>
          </div>

          <nav className="overflow-x-auto pb-1 sm:pb-0">
            <div className="flex min-w-max gap-2">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition sm:text-sm sm:normal-case sm:tracking-normal ${
                      active
                        ? "bg-[var(--accent)] text-black"
                        : "border border-white/10 bg-white/[0.03] text-[var(--muted)] hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
