import WalletEmailVerifiedSync from "../components/WalletEmailVerifiedSync";

export default function CarteiraLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="px-4 pt-8">
        <WalletEmailVerifiedSync />
      </div>
      {children}
    </>
  );
}
