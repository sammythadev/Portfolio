import { skills } from "@/data/skills";

export function Skills() {
  return (
    <section
      id="skills"
      className="scroll-mt-24 bg-surface-muted py-20 sm:py-28"
    >
      <div className="container-page">
        <h2 className="section-title">My Skills</h2>

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {skills.map((category) => (
            <div
              key={category.title}
              className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)] transition-transform duration-300 hover:-translate-y-1"
            >
              <h3 className="flex items-center gap-3 text-xl font-bold text-primary">
                <span aria-hidden className="text-2xl">
                  {category.icon}
                </span>
                {category.title}
              </h3>

              <ul className="mt-6 flex flex-col gap-5">
                {category.items.map((skill) => (
                  <li key={skill.name} className="flex items-center gap-3">
                    {skill.icon && (
                      <span
                        aria-hidden
                        className="grid size-8 shrink-0 place-items-center text-lg"
                      >
                        {skill.icon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {skill.name}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {skill.level}%
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={skill.level}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${skill.name} proficiency`}
                        className="h-1.5 overflow-hidden rounded-full bg-border"
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-700"
                          style={{ width: `${skill.level}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}