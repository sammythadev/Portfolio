import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";

import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://sammykasper.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Samuel Kasper, Backend, DevOps & AI Infrastructure",
  description:
    "Software engineer building backend systems, DevOps pipelines, AI infrastructure and reliability tooling. NestJS, Express, Docker, Kubernetes, Kafka, Postgres and LLM agent systems.",
  keywords: [
    "Samuel Kasper",
    "Backend Engineer",
    "DevOps",
    "AI Engineer",
    "SRE",
    "NestJS",
    "Kubernetes",
    "LLM",
  ],
  authors: [{ name: "Samuel Kasper", url: "https://github.com/sammythadev" }],
  creator: "Samuel Kasper",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Samuel Kasper",
    title: "Samuel Kasper, Backend, DevOps & AI Infrastructure",
    description:
      "Backend systems, delivery pipelines, AI infrastructure and reliability tooling.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Samuel Kasper, Backend, DevOps & AI Infrastructure",
    description:
      "Backend systems, delivery pipelines, AI infrastructure and reliability tooling.",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${geist.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-on-surface selection:bg-surface-bright selection:text-primary font-body-sm text-[14px] antialiased min-h-dvh flex flex-col justify-between relative">
        {children}
      </body>
    </html>
  );
}