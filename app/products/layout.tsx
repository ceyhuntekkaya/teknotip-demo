import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ürünler — TeknoTip",
  description: "Ürün, özellik ve aksesuar verisini düzenle.",
};

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
