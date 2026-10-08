import { Decrypt } from "@/components/site/decrypt";
import { milestones } from "@/data/timeline";

export function Timeline() {
  return (
    <section
      className="space-y-6 pt-6 border-t border-border-line cinematic-section"
      id="timeline"
      data-section-name="TIMELINE"
    >
      <div>
        <h2 className="font-headline-md text-[20px] font-semibold text-primary tracking-tight">
          <Decrypt text="Timeline & Architecture" animateOn="view" />
        </h2>
        <p className="font-body-sm text-[13px] text-text-dim">
          Chronological track record of systems designed, shipped and maintained.
        </p>
      </div>

      <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-border-line">
        {milestones.map((milestone) => (
          <div key={milestone.title} className="relative pl-8">
            <div
              className={`absolute left-2.5 top-1.5 w-1.5 h-1.5 rounded-full -translate-x-1/2 ${
                milestone.current ? "bg-primary" : "bg-text-dim"
              }`}
            />
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
              <h3 className="font-body-lg text-[15px] text-primary font-semibold">
                {milestone.title}
              </h3>
              <span className="font-label-tag text-[11px] text-text-dim">
                {milestone.period}
              </span>
            </div>
            <div className="font-label-code text-[12px] text-text-dim">
              {milestone.context}
            </div>
            <p className="font-body-sm text-[13px] text-on-surface-variant mt-2 leading-relaxed text-pretty">
              {milestone.detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}