import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Geçici Ürünler — TeknoTip",
  description: "Organized ürünleri düzenle ve asıl kataloga aktar.",
};

export default function OrganizedProductsLayout({
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
