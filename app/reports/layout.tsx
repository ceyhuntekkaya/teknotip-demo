import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Raporlar — TeknoTip",
  description: "Teklif ve satış raporları.",
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh min-h-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}
