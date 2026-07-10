"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const EMAIL_KEY = "dados-fii-wallet-email";

function allowedAdminEmails() {
  const explicit = String(process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const pilot = String(process.env.NEXT_PUBLIC_RISK_REPORT_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set([...explicit, ...pilot]));
}

export default function AdminEntryLink() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const email = String(window.localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
    setVisible(Boolean(email && allowedAdminEmails().includes(email)));
  }, []);

  if (!visible) return null;

  return (
    <Link
      href="/admin/observabilidade"
      className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold text-indigo-700 hover:bg-white hover:shadow-sm md:text-sm"
    >
      <ShieldCheck size={15} /> Admin
    </Link>
  );
}
