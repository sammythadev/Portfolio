import { TechChip } from "@/components/site/tech-chip";
/*
  The 3D workstation stage and the dither curtain used to be rendered here.

  Both are now in the Playground section, loaded on demand. They were the two
  heaviest things on the page — a three.js scene with a Draco GLB and a fragment
  shader pipeline — and sitting inside this section put their chunks in the
  initial route payload, so a visitor who never scrolled this far paid for them
  anyway. This section is now pure data: the capability matrix, which costs
  nothing to render.
*/
import { Decrypt } from "@/components/site/decrypt";
import { stackLayers } from "@/data/stack";
import { Icon } from "@/components/site/icon";

const layerItemCount = stackLayers.reduce((n, l) => n + l.items.length, 0);

export function Stack() {
  return (
    <section
      className="space-y-6 pt-6 border-t border-border-line cinematic-section"
      id="stack"
      data-section-name="STACK"
    >
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div>
          <h2 className="font-headline-md text-[20px] font-semibold text-primary tracking-tight">
            <Decrypt text="Stack & Systems Matrix" animateOn="view" />
          </h2>
          <p className="font-body-sm text-[13px] text-text-dim">
            Capability matrix across the stack, grouped into layers. The two
            interactive playgrounds live below and load on demand.
          </p>
        </div>
        <div className="flex items-center gap-2 font-label-tag text-[11px] text-text-dim">
          <span className="w-1.5 h-1.5 rounded-full bg-signal-fault" />
          <span>4 capability layers</span>
        </div>
      </div>

      <div className="rounded-xl border border-border-line bg-surface-card overflow-hidden relative">
        <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-border-line bg-surface-card/95 font-label-code text-[12px] gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon name="memory" className="text-[15px] text-signal-fault shrink-0" />
            <span className="text-primary font-semibold tracking-tight truncate">
              Capability matrix
            </span>
            <span className="hidden md:inline text-text-dim text-[11px]">
              {stackLayers.length} layers · {layerItemCount} entries
            </span>
          </div>
          <div className="font-label-tag text-[11px] text-text-dim">
            Playgrounds moved below
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stackLayers.map((layer) => (
          <div
            key={layer.id}
            className="rounded-xl border border-border-line bg-surface-card p-5 space-y-3"
          >
            <div className="flex items-center gap-2 border-b border-border-line pb-2 min-w-0">
              <Icon name={layer.icon} className="text-text-dim text-[16px] shrink-0" />
              <span className="font-label-code text-[13px] text-primary font-semibold truncate">
                {layer.title}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-body-sm text-[13px]">
              {layer.items.map((item) => (
                /*
                  Tier sits on its own line rather than sharing a row with the
                  technology name. In a two-up grid the badge stole enough width
                  to clip three of the longest labels ("Prisma / Sequelize /
                  Mongoose" was cut by 35px, "AWS · GCP · Vercel · Terraform" by
                  24px, "LLM gateway & provider routing" by 16px). The names
                  carry the information and the tier is a classification, so the
                  tier yields.
                */
                <div
                  key={item.name}
                  className="p-2.5 rounded-lg border border-border-line bg-surface-container-lowest flex flex-col gap-1.5 min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/*
                      The real brand mark leads the row. `TechIcon` renders
                      `currentColor`-independent brand hex from simple-icons, so
                      each row reads as the technology it names rather than as a
                      generic bordered box. An unmapped name falls back to the
                      text alone inside TechChip.
                    */}
                    <TechChip
                      className="border-transparent bg-transparent px-0 py-0 text-primary"
                      iconClassName="size-4 shrink-0"
                      tech={item.name}
                    />
                  </div>
                  {item.detail ? (
                    <span className="font-body-sm text-[12px] text-text-dim leading-snug min-w-0">
                      {item.detail}
                    </span>
                  ) : null}
                  <span className="font-label-tag text-[11px] text-text-dim shrink-0">
                    {item.tier}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}