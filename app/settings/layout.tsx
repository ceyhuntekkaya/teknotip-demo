import type { Metadata } from "next";
import { SettingsFrame } from "@/components/settings/settings-frame";

export const metadata: Metadata = {
  title: "Ayarlar — TeknoTip",
  description: "Kullanıcılar, AI ayarları ve geçici ürünler.",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh min-h-0 flex-1 flex-col overflow-hidden">
      <SettingsFrame>{children}</SettingsFrame>
    </div>
  );
}
