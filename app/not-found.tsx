import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/site/icon";

export const metadata: Metadata = {
  title: "Page Not Found",
};

export default function NotFound() {
  return (
    <main className="w-full max-w-[1080px] mx-auto border-x border-border-line flex-1 px-6 py-24 flex flex-col items-center justify-center gap-6 text-center">
      <p className="font-label-code text-6xl font-bold text-primary tabular-nums sm:text-8xl">
        404
      </p>
      <h1 className="font-headline-md text-2xl font-semibold text-primary tracking-tight text-balance sm:text-3xl">
        This page doesn&apos;t exist
      </h1>
      <p className="font-body-sm max-w-prose text-text-dim text-pretty">
        The link you followed may be broken, or the page may have been moved.
      </p>
      <Link
        href="/"
        className="px-3.5 py-1.5 rounded-lg bg-primary text-black font-body-sm text-[13px] font-semibold hover:bg-white active:scale-[0.97] transition-[background-color,transform] duration-150 ease-out inline-flex items-center gap-1.5"
      >
        Back to home
        <Icon name="west" className="text-[16px]" />
      </Link>
    </main>
  );
}