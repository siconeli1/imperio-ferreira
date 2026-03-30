import type { ButtonHTMLAttributes, ReactNode } from "react";

export function AdminPageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="mb-8 grid gap-4 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.16))] p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        {eyebrow && <p className="text-xs uppercase tracking-[0.26em] text-[var(--accent-strong)]">{eyebrow}</p>}
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{title}</h1>
        {description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </section>
  );
}

export function AdminPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.18))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)] sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.2))] p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-strong)]">{label}</p>
      <p className="mt-4 text-2xl font-semibold sm:text-3xl">{value}</p>
      {note ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{note}</p> : null}
    </div>
  );
}

export function AdminNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "danger";
  children: ReactNode;
}) {
  const palette =
    tone === "success"
      ? "border-emerald-700 bg-emerald-950/40 text-emerald-100"
      : tone === "danger"
        ? "border-red-700 bg-red-950/50 text-red-100"
        : "border-white/10 bg-white/[0.04] text-[var(--foreground)]";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${palette}`}>{children}</div>;
}

export function AdminScopeNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--foreground)]">
      <p className="font-semibold text-[var(--accent-strong)]">{title}</p>
      <p className="mt-1 text-[var(--muted)]">{description}</p>
    </div>
  );
}

export function AdminActionButton({
  children,
  tone = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger";
}) {
  const palette =
    tone === "primary"
      ? "bg-[var(--accent)] text-black hover:bg-[var(--accent-strong)]"
      : tone === "danger"
        ? "border border-red-500 text-red-200 hover:bg-red-950/30"
        : "border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]";

  return (
    <button
      {...props}
      className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${palette} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function AdminToast({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "danger";
  children: ReactNode;
}) {
  const palette =
    tone === "success"
      ? "border-emerald-600/70 bg-emerald-950/95 text-emerald-100"
      : tone === "danger"
        ? "border-red-600/70 bg-red-950/95 text-red-100"
        : "border-white/15 bg-[rgba(8,12,11,0.96)] text-white";

  return (
    <div className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl ${palette}`}>
      {children}
    </div>
  );
}
