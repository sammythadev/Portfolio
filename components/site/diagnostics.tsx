import { siteConfig } from "@/data/site";
import { Icon } from "@/components/site/icon";

type LogLine = {
  tag: string;
  tone: "primary" | "dim" | "surface" | "fault";
  message: string;
};

/*
  What this panel used to be, and why it changed.

  It rendered a fake boot log: hardcoded timestamps (14:02:11.890), a fabricated
  region ("REGION: us-east-1a") that no static site has, a live-looking
  "STATUS: NOMINAL" indicator, and a permanently blinking block cursor sitting
  next to the last line to imply output still arriving. None of it was real and
  none of it was reading from anything. On a portfolio whose credibility rests
  on the engineering claims underneath it, inventing infrastructure telemetry is
  the wrong thing to show a reader, and the endless cursor was the last
  always-running animation on the page besides the dither curtain.

  It is now a static capability manifest. The tag vocabulary and the mono
  treatment are kept, so the panel still belongs to the instrument-panel design
  language, but every line is a real, checkable statement about the stack, and
  nothing animates or pretends to be live.

  If you later wire this to a genuine health endpoint, add a <time> column back
  and restore a cursor that only animates while a request is actually in flight.
*/
const logLines: LogLine[] = [
  {
    tag: "[BACKEND]",
    tone: "primary",
    message: "NestJS service architecture with Drizzle ORM on PostgreSQL",
  },
  {
    tag: "[AUTH]",
    tone: "dim",
    message: "JWT and OAuth 2.0 with role-based and tenant-aware access control",
  },
  {
    tag: "[PLATFORM]",
    tone: "surface",
    message: "Docker, Kubernetes and Terraform across AWS and GCP",
  },
  {
    tag: "[AI]",
    tone: "fault",
    message: "OpenAI-compatible LLM gateway, RAG pipelines and agent tooling",
  },
];

const toneClass: Record<LogLine["tone"], string> = {
  primary: "text-primary font-medium",
  dim: "text-text-dim",
  surface: "text-on-surface",
  fault: "text-signal-fault",
};

export function Diagnostics() {
  return (
    <section
      className="border-b border-border-line pb-8 pt-2 cinematic-section"
      data-section-name="DIAGNOSTICS"
    >
      <div className="rounded-xl border border-border-line bg-surface-card p-4 overflow-hidden relative font-label-code text-[12px]">
        <div className="flex items-center justify-between gap-3 border-b border-border-line pb-2.5 mb-3 text-text-dim">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="terminal" className="text-[14px] shrink-0" />
            {/*
              This panel used to have no heading at all: its only title was an
              11px uppercase label that Tailwind hid below 640px, so on a phone
              the first thing under the hero was an untitled box of monospaced
              lines. The title is now a real `<h2>` — it appears in the document
              outline, it is what a screen reader announces, and it is visible at
              every width.
            */}
            <h2 className="truncate font-label-code text-[13px] font-semibold text-primary">
              Capability Manifest
            </h2>
          </div>
          <div className="flex items-center gap-3 font-label-tag text-[11px]">
            <span className="text-text-dim hidden sm:inline truncate">
              stack://{siteConfig.username}
            </span>
            <span className="flex items-center gap-1 text-on-surface shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-signal-fault" /> 4 layers
            </span>
          </div>
        </div>

        <div className="space-y-1.5 text-on-surface-variant font-label-code text-[12px]">
          {logLines.map((line) => (
            <div key={line.tag} className="flex items-start gap-2">
              <span className={`${toneClass[line.tone]} shrink-0`}>{line.tag}</span>
              <span className="min-w-0">{line.message}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}