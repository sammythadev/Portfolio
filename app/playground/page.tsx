import type { Metadata } from "next";

import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { Icon } from "@/components/site/icon";
import { PlaygroundStages } from "@/components/site/playground-stages";
import { Toast } from "@/components/site/toast";
import { referenceProjects } from "@/data/reference-projects";

/**
 * /playground — the interactive work, on its own route.
 *
 * This is deliberately a separate page rather than another section. Everything
 * here is WebGL, and a separate route means none of it is in the home page's
 * payload at all: the three.js runtime, the Draco GLB, the dither fragment
 * pipeline and the grid-floor shaders are fetched only when someone actually
 * navigates here. Keeping it inline on `/` would have meant paying for it on
 * every first paint.
 */
export const metadata: Metadata = {
  title: "Playground · Samuel Kasper",
  description:
    "Real-time WebGL work: a perspective grid shader, a three.js inspection stage and a live ordered-dither fragment pipeline.",
  openGraph: {
    title: "Playground · Samuel Kasper",
    description:
      "Real-time WebGL work: a perspective grid shader, a three.js inspection stage and a live ordered-dither fragment pipeline.",
  },
};

export default function PlaygroundPage() {
  return (
    <>
      <Header />

      <main className="site-main w-full max-w-[1080px] mx-auto border-x border-border-line flex-1">
        {/*
          The scroll sequence opens the route, edge to edge and full height. The
          title is passed into it as an overlay rather than stacked above it, so
          the first thing on screen is the environment itself — the room the
          character is sitting in — and the copy rides over it. A heading in
          normal flow pushed the scene below the fold and made the whole act look
          like an illustration under a page title.
        */}
        <PlaygroundStages
          overlay={
            <div className="mx-auto w-full max-w-[1080px] px-6 pt-[clamp(72px,14vh,140px)]">
              {/*
                The scene behind this is the room's cream backdrop, not the
                site's black — so the overlay cannot use the site's text tokens.
                `text-primary` is near-white and disappeared into the wall.
                These two values are chosen against the beige field instead: a
                near-black for the heading and a warm mid-grey for the body,
                both comfortably past 4.5:1 on #f5efe6.
              */}
              {/*
                The author's name sits above the act title, the way the reference
                pairs its author's name with the scene.
              */}
              <p className="font-headline-md text-[clamp(20px,1.6vw+12px,28px)] font-semibold tracking-tight text-[#16130f]">
                Samuel Kasper
                <span className="ml-2 font-label-tag text-[11px] font-normal uppercase tracking-[0.14em] text-[#4a4238]">
                  Portfolio
                </span>
              </p>

              <h1 className="mt-1 font-headline-lg text-[clamp(28px,3vw+14px,44px)] font-semibold leading-tight tracking-tight text-[#16130f]">
                Playground
              </h1>
              <p className="mt-3 max-w-[46ch] font-body-sm text-[14px] leading-relaxed text-[#4a4238]">
                Three real-time surfaces, each running its own shader pipeline in
                the browser. Nothing here is pre-rendered video — every frame is
                computed on the GPU. The stages load when this route is opened,
                not with the rest of the site.
              </p>
            </div>
          }
        />

        <div className="space-y-8 px-6 py-8">

        {/*
          Index of the reference portfolio's own work. Not mine, and labelled as
          such throughout — the point is to make the lineage of the ideas above
          traceable, which is what the CC BY-NC-SA licence asks for. Only titles,
          tags and links are reproduced; none of the upstream images or videos
          are re-hosted here.
        */}
        <section aria-labelledby="pg-reference" className="space-y-4 pt-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <h2
                className="font-headline-md text-[20px] font-semibold tracking-tight text-primary"
                id="pg-reference"
              >
                Where this came from
              </h2>
              <p className="font-body-sm text-[13px] text-text-dim">
                Projects by David Heckhoff, the author of the reference portfolio.
                His work, not mine.
              </p>
            </div>
            <span className="shrink-0 self-start rounded border border-border-line px-2 py-0.5 font-label-tag text-[11px] text-text-dim">
              {referenceProjects.length} projects
            </span>
          </div>

          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {referenceProjects.map((project) => {
              const body = (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-headline-md text-[16px] font-semibold tracking-tight text-primary">
                      {project.title}
                    </h3>
                    {project.href ? (
                      <Icon
                        name="north_east"
                        className="arrow-nudge shrink-0 text-[15px] text-text-dim transition-colors group-hover:text-signal-fault"
                      />
                    ) : null}
                  </div>
                  <p className="font-body-sm text-[13px] leading-relaxed text-on-surface-variant">
                    {project.note}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {project.tags.map((tag) => (
                      <span
                        className="rounded border border-border-line bg-surface-container-lowest px-1.5 py-0.5 font-label-tag text-[10px] text-text-dim"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              );

              return (
                <li key={project.title}>
                  {project.href ? (
                    <a
                      className="group flex h-full flex-col gap-2 rounded-xl border border-border-line bg-surface-card p-4 transition-colors hover:bg-surface-hover"
                      href={project.href}
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      {body}
                    </a>
                  ) : (
                    <div className="group flex h-full flex-col gap-2 rounded-xl border border-border-line bg-surface-card p-4">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/*
          Required visible attribution for the referenced portfolio. The
          upstream licence requires that derivative works show a visible
          reference to the original, not just a source comment, so this is in
          the page body. See also the README attribution section.
        */}
        <footer className="border-t border-border-line pt-5">
          <p className="max-w-[70ch] font-label-tag text-[11px] leading-relaxed text-text-dim">
            The room, the character, its matcap, head and face shaders, the grid
            floor and the scroll-driven camera are all ported from{" "}
            <a
              className="text-on-surface underline decoration-border-line underline-offset-2 hover:decoration-signal-fault"
              href="https://github.com/davidhckh/portfolio-2025"
              rel="noreferrer noopener"
              target="_blank"
            >
              davidhckh/portfolio-2025
            </a>{" "}
            by David Heckhoff, used under{" "}
            <a
              className="text-on-surface underline decoration-border-line underline-offset-2 hover:decoration-signal-fault"
              href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
              rel="noreferrer noopener"
              target="_blank"
            >
              CC BY-NC-SA 4.0
            </a>
            . Rewritten for React and Next.js; the models, textures, shaders and
            scene-weight camera system are upstream's, with their timings and
            constants reproduced unchanged. Commercial reuse is not permitted.
          </p>
        </footer>
        </div>
      </main>

      <Footer />
      <Toast />
    </>
  );
}