import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // pdfkit (used by /api/assessments/export-pdf) pulls in fontkit, which
  // uses legacy decorator-based exports that Turbopack's strict ESM
  // bundling can't resolve ("Export applyDecoratedDescriptor doesn't
  // exist in target module"). Marking these as external tells Next.js to
  // leave them out of the bundle and `require()` them directly from
  // node_modules at runtime (Node.js runtime only — fine here since this
  // route already declares `export const runtime = "nodejs"`).
  serverExternalPackages: ["pdfkit", "fontkit"],
};

export default nextConfig;
