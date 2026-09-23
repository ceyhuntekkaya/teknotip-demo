import type { ReactNode } from "react";
import { AppNav } from "@/components/layout/app-nav";

type SplitWorkspaceProps = {
  eyebrow: string;
  title: string;
  listHeader: ReactNode;
  list: ReactNode;
  children: ReactNode;
  listWidthClassName?: string;
  detailClassName?: string;
  actions?: ReactNode;
};

export function SplitWorkspace({
  eyebrow,
  title,
  listHeader,
  list,
  children,
  listWidthClassName = "lg:w-64",
  detailClassName = "overflow-y-auto p-5",
  actions,
}: SplitWorkspaceProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] px-5 py-3">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
            {eyebrow}
          </p>
          <h1 className="font-display text-2xl leading-none tracking-wide">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <AppNav />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <aside
          className={`flex max-h-[40dvh] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-[var(--rule)] lg:max-h-none lg:border-b-0 lg:border-r ${listWidthClassName}`}
        >
          <div className="shrink-0">{listHeader}</div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{list}</div>
        </aside>

        <section
          className={`min-h-0 flex-1 overscroll-contain ${detailClassName}`}
        >
          {children}
        </section>
      </div>
    </div>
  );
}
