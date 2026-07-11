import CalendarCopyEnhancer from "../components/CalendarCopyEnhancer";

export default function CalendarioDividendosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CalendarCopyEnhancer />
      {children}
    </>
  );
}
