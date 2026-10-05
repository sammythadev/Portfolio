import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { projects } from "@/data/projects";

export function Projects() {
  return (
    <section id="projects" className="scroll-mt-24 bg-card py-20 sm:py-28">
      <div className="container-page">
        <h2 className="section-title">Featured Projects</h2>

        <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <article
              key={project.title}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--shadow-soft)] transition-transform duration-300 hover:-translate-y-2 hover:shadow-[var(--shadow-lift)]"
            >
              <div className="relative aspect-[3/2] overflow-hidden bg-primary/10">
                {project.image ? (
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  // Deterministic gradient fallback replaces the old broken
                  // `onError` DOM mutation and its missing /project1.jpg files.
                  <div
                    aria-hidden
                    className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary to-primary-dark p-6"
                  >
                    <span className="font-mono text-lg font-bold tracking-tight text-primary-foreground/90 text-center">
                      {project.title}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-lg font-bold text-foreground">
                  {project.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {project.description}
                </p>

                <ul className="mt-4 flex flex-wrap gap-2">
                  {project.tech.map((tech) => (
                    <li key={tech}>
                      <Badge>{tech}</Badge>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row">
                  <Button asChild size="sm" className="flex-1">
                    <a
                      href={project.demoUrl}
                      target={project.demoUrl === "#" ? undefined : "_blank"}
                      rel={
                        project.demoUrl === "#" ? undefined : "noopener noreferrer"
                      }
                      aria-disabled={project.demoUrl === "#"}
                    >
                      Live Demo
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                  >
                    <a
                      href={project.codeUrl}
                      target={project.codeUrl === "#" ? undefined : "_blank"}
                      rel={
                        project.codeUrl === "#" ? undefined : "noopener noreferrer"
                      }
                      aria-disabled={project.codeUrl === "#"}
                    >
                      View Code
                    </a>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}