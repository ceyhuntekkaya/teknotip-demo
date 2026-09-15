import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teklifler — TeknoTip",
  description: "Kayıtlı teklifleri listele ve görüntüle.",
};

export default function QuotesLayout({
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
