import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page Not Found",
};

export default function NotFound() {
  return (
    <>
      <HeaderSpacer />
      <main
        id="main"
        className="container-page flex min-h-[100dvh] flex-col items-center justify-center gap-6 py-24 text-center"
      >
        <p className="font-mono text-6xl font-bold text-primary tabular-nums sm:text-8xl">
          404
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          This page doesn&apos;t exist
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          The link you followed may be broken, or the page may have been moved.
        </p>
        <Button asChild size="lg">
          <Link href="/">Back to home</Link>
        </Button>
      </main>
    </>
  );
}

/** The 404 route has no header of its own; pad below the fixed site header. */
function HeaderSpacer() {
  return <div aria-hidden className="h-20" />;
}