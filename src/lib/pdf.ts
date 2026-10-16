// PDF text extraction with coordinates (pdfjs legacy build: pure JS, no worker, no system binaries).
import type { PdfPage } from "./entry_docs";
import { pragueNow } from "./time";

interface RawItem {
  str?: string;
  transform: number[];
  width: number;
}

// "D:20261015131847Z" / "D:20261015151847+02'00'" -> Prague wall time "2026-10-15T15:18"
function pdfDate(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const m = s.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?(Z|[+-]\d{2}'?\d{2}'?)?/);
  if (!m) return null;
  const [y, mo, d, h = "00", mi = "00", se = "00"] = m.slice(1, 7);
  if (!m[7]) return `${y}-${mo}-${d}T${h}:${mi}`; // no zone: already local
  const off = m[7] === "Z" ? 0 : (m[7][0] === "-" ? -1 : 1) * (Number(m[7].slice(1, 3)) * 60 + Number(m[7].replace(/'/g, "").slice(3, 5)));
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se) - off * 60_000;
  return pragueNow(new Date(utc));
}

export async function pdfPages(buf: ArrayBuffer): Promise<{ pages: PdfPage[]; date: string | null }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true }).promise;
  let date: string | null = null;
  try {
    const meta = await doc.getMetadata();
    const info = meta.info as Record<string, unknown>;
    date = pdfDate(info.ModDate) ?? pdfDate(info.CreationDate);
  } catch {
    // metadata is optional
  }
  const pages: PdfPage[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = (tc.items as RawItem[])
      .filter((i) => typeof i.str === "string" && i.str.trim())
      .map((i) => ({ s: i.str as string, x: i.transform[4], y: i.transform[5], w: i.width }));
    pages.push({ width: vp.width, height: vp.height, items });
  }
  await doc.destroy();
  return { pages, date };
}
