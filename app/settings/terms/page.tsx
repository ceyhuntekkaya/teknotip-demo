import { BrandTermsForm } from "@/components/settings/brand-terms-form";
import { isBrandTermsList } from "@/lib/api/settings";
import { getBrandTerms } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function TermsSettingsPage() {
  const response = await getBrandTerms();
  if (response.status !== 200 || !isBrandTermsList(response.data)) {
    return (
      <p className="p-5 text-sm text-[#8f2d1f]">
        Koşullar yüklenemedi. Veritabanı kaydı hazır olduğunda yeniden deneyin.
      </p>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <BrandTermsForm initial={response.data} />
    </div>
  );
}
