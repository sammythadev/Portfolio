import { systemTelemetry } from "@/data/projects";

export function System() {
  return (
    <section
      className="rounded-xl border border-border-line bg-surface-card p-6 space-y-4 cinematic-section"
      id="system"
      data-section-name="SYSTEM"
    >
      <div className="flex items-center justify-between border-b border-border-line pb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-signal-fault shrink-0" />
          {/*
            A real `<h2>`, not a styled span. This panel is the nav's "System"
            destination, and until now that destination had no heading in the
            outline at all — a screen reader found nothing to announce and a
            sighted visitor got four numbers under a bare coloured dot. The
            heading also now starts with the word the nav used to send them
            here, so arriving at it answers "am I where I clicked?".
          */}
          <h2 className="font-headline-md text-[18px] font-semibold text-primary truncate">
            System &amp; Practice
          </h2>
        </div>
        <span className="font-label-tag text-[11px] text-text-dim font-mono shrink-0">
          {systemTelemetry.length} metrics
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
        {systemTelemetry.map((item) => (
          <div
            key={item.label}
            className="p-3 rounded-lg border border-border-line bg-surface-container-lowest"
          >
            <div className="font-label-tag text-[10px] text-text-dim">
              {item.label}
            </div>
            <div className="font-headline-md text-[18px] sm:text-[20px] font-semibold text-primary mt-1 break-words">
              {item.value}
            </div>
            <div className="font-label-tag text-[10px] text-text-dim mt-0.5">
              {item.hint}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}