import WalletHistoricalSummaryEnhancer from "../components/WalletHistoricalSummaryEnhancer";
import WalletPageUxEnhancer from "../components/WalletPageUxEnhancer";

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
