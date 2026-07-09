import Link from "next/link";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
};

function cleanSubtitle(value: string) {
  return value.replace(/^Salva neste navegador\.\s*/i, "");
}

export default function PageHeader({
  title,
  subtitle,
  backHref = "/",
  backLabel = "← Voltar para consulta",
  action,
}: PageHeaderProps) {
  const displaySubtitle = cleanSubtitle(subtitle);

  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-900">
          {backLabel}
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold text-slate-800">{title}</h1>
        <p className="mt-2 max-w-3xl text-slate-600">{displaySubtitle}</p>
      </div>
      {action}
    </div>
  );
}
