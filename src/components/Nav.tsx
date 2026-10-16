"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeGlyph, OpenWaterGlyph, OverviewGlyph, RacesGlyph, RecordsGlyph, SettingsGlyph } from "@/components/Glyphs";

type Tab = { href: string; label: string; Icon: (p: { size?: number }) => React.ReactNode; also?: string[] };

const PARENT_TABS: Tab[] = [
  { href: "/viki", label: "Viki", Icon: HomeGlyph, also: ["/rekordy"] },
  { href: "/prehled", label: "Přehled", Icon: OverviewGlyph, also: ["/plavec/"] },
  { href: "/zavody", label: "Závody", Icon: RacesGlyph, also: ["/zavod/"] },
  { href: "/dalkove", label: "Dálkové", Icon: OpenWaterGlyph },
  { href: "/nastaveni", label: "Nastavení", Icon: SettingsGlyph },
];

const KID_TABS: Tab[] = [
  { href: "/viki", label: "Domů", Icon: HomeGlyph },
  { href: "/zavody", label: "Závody", Icon: RacesGlyph, also: ["/zavod/"] },
  { href: "/rekordy", label: "Rekordy", Icon: RecordsGlyph },
  { href: "/dalkove", label: "Dálkové", Icon: OpenWaterGlyph },
];

export default function Nav({ role = "parent" }: { role?: "parent" | "kid" }) {
  const pathname = usePathname();
  const tabs = role === "kid" ? KID_TABS : PARENT_TABS;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),10px)]" aria-label="Hlavní navigace">
      <div
        className="mx-auto grid max-w-md gap-1 rounded-[22px] bg-white/90 p-1.5 shadow-[0_12px_32px_-12px_rgb(5_39_58/0.45)] ring-1 ring-pool-900/5 backdrop-blur-md"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map(({ href, label, Icon, also }) => {
          const active = pathname.startsWith(href) || (also ?? []).some((p) => pathname.startsWith(p));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-semibold transition-colors ${
                active ? "bg-deep text-white" : "text-pool-900/55 hover:bg-pool-50 hover:text-pool-800"
              }`}
            >
              <Icon size={22} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
