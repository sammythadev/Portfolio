import { FaGithub, FaLinkedinIn, FaXTwitter, FaEnvelope } from "react-icons/fa6";
import type { SocialLink } from "./social";

export const socialLinks: SocialLink[] = [
  {
    name: "GitHub",
    href: "https://github.com/sammythadev",
    icon: FaGithub,
    external: true,
  },
  {
    name: "LinkedIn",
    href: "https://linkedin.com/in/samuelkasper",
    icon: FaLinkedinIn,
    external: true,
  },
  {
    name: "X",
    href: "https://x.com/real_kazper",
    icon: FaXTwitter,
    external: true,
  },
  {
    name: "Email",
    href: "mailto:samuelkasper142@gmail.com",
    label: "samuelkasper142@gmail.com",
    icon: FaEnvelope,
  },
];

export const siteConfig = {
  name: "Samuel Kasper",
  role: "Blockchain & Full-Stack Developer",
  description:
    "Blockchain engineer and full-stack developer building decentralized applications and scalable web solutions.",
  url: "https://sammykasper.dev",
  email: "samuelkasper142@gmail.com",
} as const;

export type NavItem = {
  name: string;
  href: string;
};

export const navItems: NavItem[] = [
  { name: "About", href: "#about" },
  { name: "Skills", href: "#skills" },
  { name: "Projects", href: "#projects" },
  { name: "Contact", href: "#contact" },
];