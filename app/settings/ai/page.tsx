import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { isAiSettings } from "@/lib/api/settings";
import { getAiSettings } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const response = await getAiSettings();
  if (response.status !== 200 || !isAiSettings(response.data)) {
    return (
      <p className="p-5 text-sm text-[#8f2d1f]">
        AI ayarları yüklenemedi. Veritabanı kaydı hazır olduğunda yeniden deneyin.
      </p>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <AiSettingsForm initial={response.data} />
    </div>
  );
}
