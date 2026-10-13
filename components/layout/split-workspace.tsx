import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";

type SplitWorkspaceProps = {
  section: string;
  title: string;
  listHeader: ReactNode;
  list: ReactNode;
  children: ReactNode;
  listWidthClassName?: string;
  detailClassName?: string;
  actions?: ReactNode;
  showHeader?: boolean;
};

export function SplitWorkspace({
  section,
  title,
  listHeader,
  list,
  children,
  listWidthClassName = "lg:w-64",
  detailClassName = "overflow-y-auto p-5",
  actions,
  showHeader = true,
}: SplitWorkspaceProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {showHeader ? <AppHeader section={section} title={title} actions={actions} /> : null}

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
