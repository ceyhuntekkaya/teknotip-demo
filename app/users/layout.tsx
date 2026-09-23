import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kullanıcılar — TeknoTip",
  description: "Uygulama kullanıcılarını yönet.",
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
