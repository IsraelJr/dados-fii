import WalletPageUxEnhancer from "../components/WalletPageUxEnhancer";

export default function CarteiraLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <WalletPageUxEnhancer />
      <div className="w-full max-w-full overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
