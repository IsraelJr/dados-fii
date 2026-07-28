import Link from "next/link";
import { BarChart3, BookOpen, CalendarDays, Home, LibraryBig, Wallet } from "lucide-react";
import AdminEntryLink from "./AdminEntryLink";

const links = [
  { href: "/", label: "Início", icon: Home },
  { href: "/guias", label: "Guias", icon: LibraryBig },
  { href: "/carteira", label: "Carteira", icon: Wallet },
  { href: "/calendario-dividendos-fiis", label: "Calendário", icon: CalendarDays },
  { href: "/glossario", label: "Glossário", icon: BookOpen },
];

export default function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-slate-900" aria-label="Dados FII - Início">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm"><BarChart3 size={20} /></span>
          <span className="leading-tight">Dados FII<span className="block text-xs font-bold text-slate-600">Fundos imobiliários</span></span>
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto rounded-full bg-slate-100 p-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-white hover:text-indigo-700 hover:shadow-sm md:text-sm"><Icon size={15} /> {label}</Link>
          ))}
          <AdminEntryLink />
        </div>
      </nav>
    </header>
  );
}
