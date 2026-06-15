"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PARENT_TABS = [
  { href: "/viki", label: "Viki", emoji: "🏊‍♀️" },
  { href: "/prehled", label: "Přehled", emoji: "📊" },
  { href: "/zavody", label: "Závody", emoji: "🏁" },
  { href: "/dalkove", label: "Dálkové", emoji: "🌊" },
  { href: "/nastaveni", label: "Nastavení", emoji: "⚙️" },
];

const KID_TABS = [
  { href: "/viki", label: "Moje plavání", emoji: "🏊‍♀️" },
  { href: "/dalkove", label: "Dálkové", emoji: "🌊" },
  { href: "/zavody", label: "Závody", emoji: "🏁" },
];

const COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

export default function Nav({ role = "parent" }: { role?: "parent" | "kid" }) {
  const pathname = usePathname();
  const tabs = role === "kid" ? KID_TABS : PARENT_TABS;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-t border-pool-100 pb-[env(safe-area-inset-bottom)]">
      <div className={`mx-auto max-w-3xl grid ${COLS[tabs.length] ?? "grid-cols-4"}`}>
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-pool-600" : "text-pool-900/50 hover:text-pool-700"
              }`}
            >
              <span className="text-xl leading-none">{t.emoji}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
