import Link from "next/link";
import type { ReactNode } from "react";

const links = [
  { href: "/admin/risk-lab", label: "Risk Lab" },
  { href: "/admin/risk-lab/automatic", label: "Pesquisa automática" },
  { href: "/admin/risk-lab/stress-runs", label: "Execuções de estresse" },
  { href: "/admin/risk-lab/cohort-backtest", label: "Pendências Sprint 3.5" },
];

export default function RiskLabAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-800 bg-slate-950 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full bg-slate-800 px-3 py-2 text-xs font-extrabold transition hover:bg-violet-700"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
