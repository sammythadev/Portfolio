import Image from "next/image";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/data/site";

export function Hero() {
  return (
    <section
      id="hero"
      className="flex min-h-[100dvh] items-center bg-gradient-to-br from-background via-background to-surface-muted pt-24"
    >
      <div className="container-page flex flex-col items-center gap-12 py-16 text-center lg:flex-row lg:justify-between lg:gap-16 lg:py-24 lg:text-left">
        <div className="max-w-xl">
          <p className="mb-4 font-mono text-sm font-medium tracking-widest text-primary uppercase">
            {siteConfig.role}
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Hi, I&apos;m <span className="text-primary">{siteConfig.name}</span>
          </h1>
          <p className="mt-6 max-w-prose text-lg leading-relaxed text-muted-foreground text-pretty">
            Building decentralized applications and scalable web solutions — from
            smart contracts to production-grade interfaces.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
            <Button asChild size="lg">
              <a href="#projects">View My Work</a>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <a href="#contact">Contact Me</a>
            </Button>
          </div>
        </div>

        <div className="relative size-64 shrink-0 sm:size-80 lg:size-96">
          <div
            aria-hidden
            className="absolute top-1/2 left-1/2 size-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/40 blur-2xl animate-pulse-orb"
          />
          <Image
            src="/profile.jpeg"
            alt={`Portrait of ${siteConfig.name}`}
            width={554}
            height={554}
            // `preload` replaces the `priority` prop deprecated in Next.js 16.
            preload
            className="relative z-10 size-full rounded-3xl object-cover shadow-[var(--shadow-lift)]"
          />
        </div>
      </div>
    </section>
  );
}