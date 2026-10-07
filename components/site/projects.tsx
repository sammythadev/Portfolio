import { TechChip } from "@/components/site/tech-chip";
import { Decrypt } from "@/components/site/decrypt";
import { projects } from "@/data/projects";
import { Icon } from "@/components/site/icon";

export function Projects() {
  return (
    <section
      className="space-y-6 cinematic-section"
      id="projects"
      data-section-name="PROJECTS"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="font-headline-md text-[20px] font-semibold text-primary tracking-tight">
            <Decrypt text="Projects & Architecture" animateOn="view" />
          </h2>
          <p className="font-body-sm text-[13px] text-text-dim">
            Five shipped systems. Each one is a real service, with the
            architecture and the numbers behind it.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded border border-border-line font-label-tag text-[11px] text-text-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-fault" />
            <span>{projects.length} projects</span>
          </div>
        </div>
      </div>

      {/*
        The React Bits <AccordionGallery /> hover panel used to sit here, with
        five generated SVG architecture diagrams from `project-panels.tsx` drawn
        specifically to feed its `image` prop. Both are gone.

        The accordion asked for hover on a desktop and collapsed to 150px slabs
        on a phone, which hid the diagrams it existed to show; the same
        architecture content is now readable as the detail matrix below. The
        motion budget went to the playground page, where it carries a real
        WebGL scene rather than a static diagram.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
        {projects.map((project) => (
          <article
            key={project.spec}
            className="spotlight-card relative rounded-xl border border-border-line bg-surface-card p-5 md:p-6 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
            <div className="panel-accent-bar absolute top-0 left-0 h-[2px] bg-signal-fault w-full" />

            <div className="relative flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between border-b border-border-line pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name={project.icon} className="text-signal-fault text-[16px] shrink-0" />
                  <span className="font-label-code text-[13px] text-primary font-semibold truncate">
                    {project.spec}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-label-tag text-[11px] px-2 py-0.5 rounded border border-border-line bg-surface-container text-primary font-mono">
                    {project.domain}
                  </span>
                </div>
              </div>

              <div className="w-full rounded-lg border border-border-line bg-surface-container-lowest p-3.5 space-y-2 font-label-code text-[12px] text-text-dim">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  {project.stats.map((stat) => (
                    <div key={stat.label} className="min-w-0">
                      <dt className="inline text-text-dim">{stat.label}: </dt>
                      <dd className="inline text-on-surface">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <h3 className="font-headline-md text-[18px] sm:text-[20px] font-semibold text-primary tracking-tight">
                  <Decrypt text={project.heading} animateOn="hover" />
                </h3>
                <p className="font-body-sm text-[13px] text-on-surface-variant mt-2 leading-relaxed">
                  {project.description}
                </p>
              </div>

              <div className="pt-3 border-t border-border-line flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {project.tech.map((tech) => (
                    <TechChip key={tech} tech={tech} />
                  ))}
                </div>
                {/*
                  `py-1.5`: this link rendered 18px tall, under the 24px
                  minimum target size (WCAG 2.2, 2.5.8). The negative margin
                  keeps the card's bottom row optically where it was.
                */}
                <a
                  className="font-label-code text-[12px] text-primary hover:text-signal-fault transition-colors -my-1.5 py-1.5 flex items-center gap-1.5 group font-medium"
                  href={project.link}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span>{project.linkLabel}</span>
                  <Icon name="north_east" className="text-[15px] arrow-nudge" />
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}