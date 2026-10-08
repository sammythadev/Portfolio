export const siteConfig = {
  name: "Samuel Kasper",
  role: "Software Engineer",
  discipline: "Backend Architecture · DevOps · Reliability",
  bio: "Software Engineer | Backend Architecture | DevOps | Reliability",
  location: "earth",
  url: "https://sammykasper.dev",
  email: "samuelkasper142@gmail.com",
  github: "https://github.com/sammythadev",
  username: "sammythadev",
} as const;

export type NavItem = {
  label: string;
  href: string;
};

export const navItems: NavItem[] = [
  { label: "Projects", href: "#projects" },
  { label: "Stack", href: "#stack" },
  /*
    The playground is a separate route, not a home-page section — it is all
    WebGL and keeping it inline would put three.js, a Draco GLB and two shader
    pipelines in the first paint. An in-page `#playground` anchor would scroll
    to nothing.
  */
  { label: "Playground", href: "/playground" },
  { label: "Timeline", href: "#timeline" },
  { label: "System", href: "#system" },
];

export const socialLinks = [
  { name: "GitHub", href: "https://github.com/sammythadev", short: "Source" },
  { name: "LinkedIn", href: "https://linkedin.com/in/samuelkasper", short: "LinkedIn" },
  { name: "X", href: "https://x.com/real_kazper", short: "X" },
  { name: "Email", href: "mailto:samuelkasper142@gmail.com", short: "Contact" },
] as const;

export const statusBadge = {
  label: "Systems Operational",
  region: "us-east-1a",
} as const;