import WalletEmailSync from "../components/WalletEmailSync";

export default function CarteiraLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="px-4 pt-8">
        <WalletEmailSync />
      </div>
      {children}
    </>
  );
}
