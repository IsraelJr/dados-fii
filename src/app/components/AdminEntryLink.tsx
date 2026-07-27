"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function AdminEntryLink() {
  return (
    <Link
      href="/admin/observabilidade"
      className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold text-indigo-700 hover:bg-white hover:shadow-sm md:text-sm"
    >
      <ShieldCheck size={15} /> Admin
    </Link>
  );
}
