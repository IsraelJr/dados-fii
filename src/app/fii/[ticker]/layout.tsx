import type { Metadata } from "next";

// Páginas programáticas permanecem fora do índice até passarem pelo gate editorial 80/100.
export const metadata: Metadata = {
  robots: { index: false, follow: true, noarchive: true },
};

export default function FundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
