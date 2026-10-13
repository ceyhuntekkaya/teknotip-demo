import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ayarlar — TeknoTip",
  description: "Kullanıcılar ve AI ayarları.",
};

export default function UsersLayout({
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
