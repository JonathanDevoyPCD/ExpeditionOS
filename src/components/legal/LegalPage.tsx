import Link from "next/link";
import { ArrowLeft, Mountain } from "lucide-react";
import type { ReactNode } from "react";

export default function LegalPage({ eyebrow, title, summary, children }: { eyebrow: string; title: string; summary: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#041421] px-5 py-8 text-[#d0d6d6] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xs font-semibold text-[#86b9b0] transition hover:text-white">
            <ArrowLeft className="size-4" /> Back to ExpeditionOS
          </Link>
          <span className="flex items-center gap-2 text-sm font-bold text-white"><Mountain className="size-5 text-[#86b9b0]" /> Expedition<span className="-ml-2 font-medium text-[#86b9b0]">OS</span></span>
        </nav>

        <article className="rounded-[30px] border border-white/[0.08] bg-[#042630]/60 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.28)] sm:p-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#86b9b0]">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#d0d6d6]/58">{summary}</p>
          <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[#d0d6d6]/30">Effective 12 August 2026 · Alpha version</p>
          <div className="mt-9 space-y-8 text-sm leading-7 text-[#d0d6d6]/62 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-[#d0d6d6]">
            {children}
          </div>
        </article>
      </div>
    </main>
  );
}
