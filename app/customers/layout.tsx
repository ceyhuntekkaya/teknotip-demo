import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Müşteriler — TeknoTip",
  description: "Müşteri kayıtlarını yönet.",
};

export default function CustomersLayout({
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
