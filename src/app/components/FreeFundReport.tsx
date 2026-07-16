import type { FreeFundReport as FreeFundReportData, FreeReportSignal } from "@/types/reports";

const SCORE_NAMES = {
  risk: "Risco",
  dividend: "Dividendos",
  governance: "Governança",
  growth: "Crescimento",
  liquidity: "Liquidez",
  quality: "Dados",
  premium: "Nota composta",
} as const;

const INVESTOR_CATEGORY_NAMES: Record<string, string> = {
  nonFinancial: "Empresas não financeiras",
  commercialBanks: "Bancos comerciais",
  brokersAndDistributors: "Corretoras e distribuidoras",
  otherFinancial: "Outras instituições financeiras",
  nonResidents: "Investidores não residentes",
  openPension: "Previdência aberta",
  closedPension: "Previdência fechada",
  publicPension: "Regimes próprios de previdência",
  insurersAndReinsurers: "Seguradoras e resseguradoras",
  capitalizationAndLeasing: "Capitalização e arrendamento",
  realEstateFunds: "Outros FIIs",
  otherFunds: "Outros fundos",
  distributors: "Distribuidores",
  other: "Outras categorias",
};

function formatNumber(value: number | null, suffix = "") {
  if (value === null) return "Não informado";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;
}

function formatCurrency(value: number | null) {
  if (value === null) return "Não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(value);
}

function formatInteger(value: number | null) {
  if (value === null) return "Não informado";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

function formatYesNo(value: boolean | null) {
  return value === null ? "Não informado" : value ? "Sim" : "Não";
}

function SignalList({ items, empty }: { items: FreeReportSignal[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.category}-${item.title}-${index}`} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-sm font-extrabold text-slate-800">{item.title}</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

export default function FreeFundReport({ report }: { report: FreeFundReportData | null }) {
  if (!report) return null;
  const scoreEntries = report.scores
    ? (Object.keys(SCORE_NAMES) as Array<keyof typeof SCORE_NAMES>).map((key) => ({ key, label: SCORE_NAMES[key], value: report.scores?.[key] }))
    : [];
  const investorCategories = Object.entries(report.fundamentals.investors?.legalEntityCategories || {})
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > 0)
    .sort((left, right) => right[1] - left[1]);

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-indigo-100 md:p-7">
      <div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-600">Relatório</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Leitura consolidada de {report.ticker}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Dados regulatórios, qualidade, scores e eventos recentes reunidos sem edição manual e sem uso de IA.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetric label="Tipo" value={report.identity.fundKind} />
        <ReportMetric label="Segmento" value={report.identity.segment || "Não informado"} />
        <ReportMetric label="DY" value={formatNumber(report.market.dividendYield, "%")} />
        <ReportMetric label="P/VP" value={formatNumber(report.market.pvp)} />
      </div>

      <div className="mt-6 rounded-2xl bg-indigo-50/60 p-4 ring-1 ring-indigo-100">
        <h3 className="text-lg font-extrabold text-indigo-950">Cadastro e estrutura do fundo</h3>
        <p className="mt-1 text-sm leading-5 text-indigo-900">Quantidades de PF e PJ representam contas de cotistas, não a participação de cada grupo no patrimônio.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ReportMetric label="CNPJ" value={report.identity.cnpj || "Não informado"} />
          <ReportMetric label="Razão social" value={report.identity.corporateName || report.identity.name} />
          <ReportMetric label="Setor" value={report.identity.sector || "Não informado"} />
          <ReportMetric label="Segmento / estratégia" value={report.identity.segment || "Não informado"} />
          <ReportMetric label="Gestor" value={report.identity.manager || "Não informado"} />
          <ReportMetric label="Administrador" value={report.identity.administrator || "Não informado"} />
          <ReportMetric label="Público-alvo" value={report.identity.targetAudience || "Não informado"} />
          <ReportMetric label="Forma do condomínio" value={report.identity.condominiumForm || "Não informado"} />
          <ReportMetric label="Classificação CVM" value={report.identity.regulatoryClassification || "Não informada"} />
          <ReportMetric label="Tipo de gestão" value={report.identity.managementType || "Não informado"} />
          <ReportMetric label="Fundo exclusivo" value={formatYesNo(report.identity.exclusive)} />
          <ReportMetric label="Fundo de fundos" value={formatYesNo(report.identity.isFundOfFunds)} />
          <ReportMetric label="Patrimônio líquido" value={formatCurrency(report.fundamentals.netWorth)} />
          <ReportMetric label="Cotas emitidas" value={formatInteger(report.fundamentals.issuedShares)} />
          <ReportMetric label="Total de cotistas" value={formatInteger(report.fundamentals.investors?.totalAccounts ?? null)} />
          <ReportMetric label="VP por cota" value={formatCurrency(report.fundamentals.navPerShare)} />
          <ReportMetric label="Cotistas PF" value={report.fundamentals.investors ? `${formatInteger(report.fundamentals.investors.individualAccounts)} · ${formatNumber(report.fundamentals.investors.individualPercent, "%")}` : "Não informado"} />
          <ReportMetric label="Cotistas PJ e outros não-PF" value={report.fundamentals.investors ? `${formatInteger(report.fundamentals.investors.legalEntityAccounts)} · ${formatNumber(report.fundamentals.investors.legalEntityPercent, "%")}` : "Não informado"} />
          <ReportMetric label="Maior cotista PJ" value={report.fundamentals.investors?.largestLegalEntityHolder?.name || "Não divulgado em fonte estruturada"} />
          <ReportMetric label="Referência cadastral" value={formatDate(report.fundamentals.referenceDate)} />
        </div>
        {!!investorCategories.length && (
          <div className="mt-4 rounded-2xl bg-white/70 p-4 ring-1 ring-indigo-100">
            <p className="text-sm font-extrabold text-indigo-950">Detalhamento das contas não-PF informado à CVM</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {investorCategories.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                  <span>{INVESTOR_CATEGORY_NAMES[key] || key}</span>
                  <strong>{formatInteger(value)}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!!scoreEntries.length && (
        <div className="mt-6">
          <h3 className="text-lg font-extrabold text-slate-900">Scores calculados</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {scoreEntries.map(({ key, label, value }) => (
              <div key={key} className="rounded-2xl bg-slate-900 p-4 text-white">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-black text-indigo-200">{value?.score ?? "-"}/100</p>
                <p className="mt-1 text-xs text-slate-300">Confiança: {value?.confidence ?? 0}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-lg font-extrabold text-slate-900">Pontos favoráveis</h3>
          <SignalList items={report.highlights} empty="Nenhum destaque com confiança suficiente foi identificado." />
        </div>
        <div>
          <h3 className="mb-3 text-lg font-extrabold text-slate-900">Pontos de atenção</h3>
          <SignalList items={report.attentionPoints} empty="Nenhum ponto de atenção relevante foi identificado nos dados disponíveis." />
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-100">
          <h3 className="font-extrabold text-indigo-950">Qualidade e rastreabilidade</h3>
          <dl className="mt-3 space-y-2 text-sm text-indigo-900">
            <QualityLine label="Validação" value={report.dataQuality.validationValid ? "Aprovada" : "Com pendências"} />
            <QualityLine label="Completude" value={formatNumber(report.dataQuality.completenessScore, "/100")} />
            <QualityLine label="Fontes" value={String(report.dataQuality.sourceCount)} />
            <QualityLine label="Erros / alertas" value={`${report.dataQuality.errors} / ${report.dataQuality.warnings}`} />
          </dl>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <h3 className="font-extrabold text-slate-900">Eventos usados na leitura</h3>
          {!report.recentEvents.length ? (
            <p className="mt-3 text-sm text-slate-500">Ainda não há eventos regulatórios recentes na base.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {report.recentEvents.map((event) => (
                <li key={event.id} className="text-sm text-slate-700">
                  <strong>{event.title}</strong> <span className="text-slate-500">· {formatDate(event.occurredAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
        {report.disclaimer.map((item) => <p key={item}>• {item}</p>)}
      </div>
    </section>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function QualityLine({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><dt>{label}</dt><dd className="font-extrabold">{value}</dd></div>;
}
