import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["192.168.1.80"],
  async headers() {
    return [
      {
        // Built from assets/models/ by `pnpm optimize:models`. Content-hashed
        // filenames would be better; until then this is immutable-ish and
        // re-optimizing requires a rename or a cache purge.
        source: "/models/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  };

/*
  No `images.remotePatterns` entry any more.

  The project gallery and the stack's dither curtain both used to point at
  images.unsplash.com, which is what this allowlist existed for. Both now render
  generated SVG from local data (see components/site/project-panels.tsx and
  dither-source.ts), so the page makes no third-party image request at all.

  Leaving the pattern in place would have been harmless but misleading: it
  documents a dependency that no longer exists.
*/

export default nextConfig;