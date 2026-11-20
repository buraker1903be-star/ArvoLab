"use client";

import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import ActionForm from "../action-form";
import { kurumSec } from "@/app/actions/kurum-secimi";
import { kurumSecimiGorunur } from "@/lib/yonetim";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  KURUM SEÇİMİ ŞERİDİ (yalnızca iç ekip, yalnızca yönetim ekranları).
  Seçici eskiden hesap menüsündeydi, seçili kurum şeridi her sayfadaydı;
  ikisi de kişisel Ana Sayfa ve Çalışmalarım'ın üstünde de duruyordu
  (PR #113). Artık yalnızca seçimin gerçekten süzdüğü ekranlarda
  (lib/yonetim.ts: kurumSecimiGorunur). Seçim yalnızca görünümü süzer,
  yetkiyi değil; satırları yine RLS seçer.
*/
export default function KurumSeridi({
  kurumlar,
  seciliKurum,
}: {
  kurumlar: { id: string; name: string }[];
  seciliKurum: { id: string; ad: string } | null;
}) {
  const t = useCeviri();
  const yol = usePathname();
  if (!kurumSecimiGorunur(yol) || (kurumlar.length < 2 && !seciliKurum)) return null;
  return (
    <div className="onizleme-serit kurum-seridi" role="region" aria-label={t({ tr: "Kurum seçimi", en: "Institution filter" })}>
      <span>
        {seciliKurum ? (
          <>
            {t({ tr: "Yalnızca", en: "Showing only" })} <b>{seciliKurum.ad}</b>
            {t({
              tr: " gösteriliyor: Yönetim, ekip ve destek kuyrukları bu kuruma göre süzülü. Kişisel Ana Sayfa ve Çalışmalarım süzülmez.",
              en: ": Management, team and support queues are filtered to this institution. Your personal Home and My works are not filtered.",
            })}
          </>
        ) : (
          t({ tr: "Bütün kurumlar gösteriliyor.", en: "Showing all institutions." })
        )}
      </span>
      {kurumlar.length > 1 ? (
        <ActionForm action={kurumSec} className="kurum-seridi-form">
          <label>
            <Building2 size={14} aria-hidden="true" />
            <span className="sr-only">{t({ tr: "Kurum", en: "Institution" })}</span>
            <select name="kurum" defaultValue={seciliKurum?.id ?? ""} key={seciliKurum?.id ?? "tumu"}>
              <option value="">{t({ tr: "Bütün kurumlar", en: "All institutions" })}</option>
              {kurumlar.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="projects-filter-button button-compact">
            {t({ tr: "Uygula", en: "Apply" })}
          </button>
        </ActionForm>
      ) : (
        <ActionForm action={kurumSec}>
          <input type="hidden" name="kurum" value="" />
          <button type="submit" className="projects-filter-button button-compact">
            {t({ tr: "Bütün kurumları göster", en: "Show all institutions" })}
          </button>
        </ActionForm>
      )}
    </div>
  );
}
