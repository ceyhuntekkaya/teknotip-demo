import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Müşteriler — TeknoTip",
  description: "Müşteri kayıtlarını yönet.",
};

export default function MusterilerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
