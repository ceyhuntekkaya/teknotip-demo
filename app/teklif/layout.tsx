import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teklif — TeknoTip",
  description: "Chat ile teklif yapılandır.",
};

export default function TeklifLayout({
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
