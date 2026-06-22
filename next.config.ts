import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist is loaded server-side at sync time to parse open-water result PDFs.
  // Keep it external so Next doesn't bundle its worker/eval internals.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
