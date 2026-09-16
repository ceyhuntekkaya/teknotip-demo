import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Temp Product Transfer — TeknoTip",
  description: "Geçici ürünleri organized_* tablolarına aktar.",
};

export default function TempProductTransferLayout({
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
