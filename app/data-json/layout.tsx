import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Katalog editörü — TeknoTip",
  description: "Ürün ailesi, model ve özellik verisini düzenle.",
};

export default function DataJsonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
