"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/prehled", label: "Žebříček" },
  { href: "/prehled/srovnani", label: "Srovnání" },
  { href: "/prehled/forma", label: "Forma" },
];

export default function PrehledTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 rounded-2xl bg-pool-100 p-1 text-sm font-semibold">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 text-center rounded-xl py-2 transition-colors ${
              active ? "bg-white text-pool-700 shadow-sm" : "text-pool-900/50 hover:text-pool-700"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
