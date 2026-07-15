import { CalendarDays, ExternalLink, FileText, Gavel, Megaphone, ScrollText } from "lucide-react";
import type { RegulatoryTimelineItem, RegulatoryTimelineResponse, RegulatoryTimelineType } from "@/types/timeline";

const TYPE_META: Record<RegulatoryTimelineType, { label: string; icon: typeof FileText; tone: string }> = {
  document: { label: "Documento", icon: FileText, tone: "bg-blue-500/15 text-blue-200 ring-blue-400/20" },
  event: { label: "Evento", icon: CalendarDays, tone: "bg-indigo-500/15 text-indigo-200 ring-indigo-400/20" },
  material_fact: { label: "Fato relevante", icon: Megaphone, tone: "bg-amber-500/15 text-amber-200 ring-amber-400/20" },
  assembly: { label: "Assembleia", icon: Gavel, tone: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/20" },
  regulation: { label: "Regulamento", icon: ScrollText, tone: "bg-purple-500/15 text-purple-200 ring-purple-400/20" },
};

function dateTime(value?: string | null) {
  if (!value) return "Data não informada";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
  } catch {
    return "Data não informada";
  }
}

export default function RegulatoryTimeline({ timeline }: { timeline: RegulatoryTimelineResponse | null }) {
  const items = timeline?.items || [];
  return (
    <section className="rounded-2xl bg-gray-900 p-5 text-gray-100 shadow-lg ring-1 ring-white/10">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h2 className="text-xl font-extrabold text-white">Timeline regulatória</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-300">Documentos, eventos, fatos relevantes, assembleias e regulamentos consolidados em ordem cronológica.</p>
        </div>
        {timeline && <span className="rounded-full bg-gray-800 px-3 py-1.5 text-xs font-bold text-gray-300 ring-1 ring-white/10">{timeline.total} registro(s)</span>}
      </div>

      {timeline && (
        <div className="mt-5 flex flex-wrap gap-2">
          {Object.entries(TYPE_META).map(([type, meta]) => {
            const Icon = meta.icon;
            return <span key={type} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ring-1 ${meta.tone}`}><Icon size={13} /> {meta.label}: {timeline.counts[type as RegulatoryTimelineType] || 0}</span>;
          })}
        </div>
      )}

      {!items.length ? (
        <div className="mt-5 rounded-xl bg-gray-800 p-5 text-sm leading-6 text-gray-300 ring-1 ring-white/5">
          Nenhum evento regulatório estruturado foi encontrado para este fundo. A timeline será preenchida automaticamente conforme documentos e eventos forem publicados pelo pipeline regulatório.
        </div>
      ) : (
        <ol className="relative mt-6 space-y-5 border-l border-indigo-400/30 pl-6">
          {items.map((item) => <TimelineItem key={item.id} item={item} />)}
        </ol>
      )}

      {!!timeline?.sources.length && <p className="mt-5 text-xs text-gray-400">Fontes: {timeline.sources.join(" · ")}</p>}
    </section>
  );
}

function TimelineItem({ item }: { item: RegulatoryTimelineItem }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  return (
    <li className="relative rounded-xl bg-gray-800 p-4 ring-1 ring-white/5">
      <span className="absolute -left-[35px] top-5 grid h-5 w-5 place-items-center rounded-full bg-indigo-500 ring-4 ring-gray-900"><Icon size={11} className="text-white" /></span>
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1 ${meta.tone}`}>{meta.label}</span>
          <h3 className="mt-2 text-base font-extrabold text-white">{item.title}</h3>
        </div>
        <time className="shrink-0 text-xs font-bold text-gray-400">{dateTime(item.occurredAt || item.publishedAt)}</time>
      </div>
      {item.summary && <p className="mt-3 text-sm leading-6 text-gray-300">{item.summary}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
        <span>{item.source}</span>
        {item.documentNumber && <span>Documento {item.documentNumber}</span>}
        {item.version && <span>Versão {item.version}</span>}
        {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-extrabold text-indigo-300 hover:text-indigo-200">Abrir fonte <ExternalLink size={12} /></a>}
      </div>
    </li>
  );
}
