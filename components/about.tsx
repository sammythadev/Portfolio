import { siteConfig } from "@/data/site";
import { stats } from "@/data/stats";

export function About() {
  return (
    <section id="about" className="scroll-mt-24 bg-card py-20 sm:py-28">
      <div className="container-page">
        <h2 className="section-title">About Me</h2>

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
              I&apos;m a passionate{" "}
              <span className="font-semibold text-primary">Blockchain Engineer</span>{" "}
              and{" "}
              <span className="font-semibold text-primary">
                Full-Stack Developer
              </span>{" "}
              with 5+ years of experience building decentralized applications and
              scalable web solutions.
            </p>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground text-pretty">
              My expertise spans smart contract development, DApp architecture, and
              creating seamless user experiences with modern web technologies.
            </p>

            <dl className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl bg-surface-muted p-6 text-center transition-transform duration-300 hover:-translate-y-1"
                >
                  <dd className="text-3xl font-bold text-primary tabular-nums">
                    {stat.value}
                  </dd>
                  <dt className="mt-1 text-sm text-muted-foreground">
                    {stat.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-dark shadow-[var(--shadow-lift)]">
            <div className="grid aspect-[4/3] place-items-center p-8 text-center">
              <div>
                <p className="font-mono text-sm tracking-widest text-primary-foreground/70 uppercase">
                  Currently
                </p>
                <p className="mt-3 text-2xl font-bold text-primary-foreground text-balance sm:text-3xl">
                  {siteConfig.role}
                </p>
                <p className="mt-4 text-primary-foreground/80 text-pretty">
                  Open to freelance work and full-time positions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}