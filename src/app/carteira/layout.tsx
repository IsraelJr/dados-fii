import WalletEmailVerifiedSync from "../components/WalletEmailVerifiedSync";

export default function CarteiraLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mx-auto w-full max-w-6xl px-4 pt-8">
        <WalletEmailVerifiedSync />
      </div>
      <div className="w-full max-w-full overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
