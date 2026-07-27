import type { Metadata } from "next";
import WalletHistoricalSummaryEnhancer from "../components/WalletHistoricalSummaryEnhancer";
import WalletPageUxEnhancer from "../components/WalletPageUxEnhancer";

export const metadata: Metadata = {
  title: "Minha carteira",
  description: "Área privada para acompanhar posições e histórico da carteira.",
  alternates: { canonical: "/carteira" },
  robots: { index: false, follow: false },
};

export default function CarteiraLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <WalletPageUxEnhancer />
      <WalletHistoricalSummaryEnhancer />
      <div className="w-full max-w-full overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
