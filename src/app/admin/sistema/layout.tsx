import type { ReactNode } from "react";
import AdminSprint35QuickAction from "@/app/admin/sistema/AdminSprint35QuickAction";

export default function AdminSystemLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminSprint35QuickAction />
      {children}
    </>
  );
}
