import AdminHealthAttentionEnhancer from "../../components/AdminHealthAttentionEnhancer";

export default function AdminObservabilidadeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminHealthAttentionEnhancer />
      {children}
    </>
  );
}
