import Link from "next/link";
import { LifeBuoy, ShieldCheck } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import ActionForm from "@/app/dashboard/action-form";
import TarihSecici from "@/app/dashboard/_components/tarih-secici";
import { etikBilgileriniKaydet } from "@/app/actions/etik-kurul";
import { ceviri } from "@/lib/dil-sunucu";
import { trGunAnahtari } from "@/lib/tr-time";
import { belgeListesiniTemizle, type EtikBelge } from "@/lib/etik/belgeler";
import { ETIK_DURUM_ADI, ETIK_DURUMLARI, etikUyarilari, type EtikDurum, type EtikKaydi, type EtikUyari } from "@/lib/etik/durum";
import EtikBelgeleri from "./etik-belgeleri";

/*
  ETİK KURUL İÇERİĞİ: sayfa (etik/page.tsx) ve Çalışmalarım'daki pencere
  (etik-penceresi.tsx) AYNI bileşeni çizer — iki yerde ayrı yazılsaydı biri
  güncellenip öteki unutulurdu (02.11.2026, kurum sahibinin isteği: "Etik
  Kurul diğerleri gibi popup açılır pencere olarak ilerlemeli").
*/

type EtikSatiri = {
  durum: string;
  kurul_adi: string | null;
  basvuru_tarihi: string | null;
  onay_tarihi: string | null;
  karar_no: string | null;
  veri_toplama_baslangic: string | null;
  gerekmeme_gerekcesi: string | null;
  notlar: string | null;
  belgeler: unknown;
  yonerge_adi: string | null;
};

export type EtikVerisi = {
  okunamadi: boolean;
  kayit: EtikSatiri | null;
  etik: EtikKaydi | null;
  belgeler: EtikBelge[];
  uyarilar: EtikUyari[];
  durum: EtikDurum;
};

export async function etikVerisiOku(supabase: SupabaseClient, projectId: string): Promise<EtikVerisi> {
  const { data, error } = await supabase.from("etik_kurul").select("*").eq("project_id", projectId).maybeSingle();
  if (error) console.error("[etik] kayıt okunamadı", error.message);
  const kayit = (data as EtikSatiri | null) ?? null;
  const belgeler = belgeListesiniTemizle(kayit?.belgeler);
  const etik: EtikKaydi | null = kayit
    ? {
        durum: kayit.durum as EtikDurum,
        onay_tarihi: kayit.onay_tarihi,
        karar_no: kayit.karar_no,
        veri_toplama_baslangic: kayit.veri_toplama_baslangic,
        gerekmeme_gerekcesi: kayit.gerekmeme_gerekcesi,
        belgeler,
      }
    : null;
  return { okunamadi: Boolean(error), kayit, etik, belgeler, uyarilar: etikUyarilari(etik, trGunAnahtari()), durum: etik?.durum ?? "belirsiz" };
}

export default async function EtikIcerigi({ projectId, veri }: { projectId: string; veri: EtikVerisi }) {
  const t = await ceviri();
  const { kayit, belgeler, uyarilar, durum } = veri;
  if (veri.okunamadi) {
    return (
      <p className="alert" role="alert">
        {t({ tr: "Etik kurul bilgileri okunamadı. Kaydınız yerinde duruyor; sayfayı yenileyin.", en: "The ethics details could not be read. Your data is safe; refresh the page." })}
      </p>
    );
  }
  return (
    <>
      {uyarilar.length ? (
        <div className="etik-uyarilar">
          {uyarilar.map((u) => (
            <p key={u.metin.tr} className="alert" data-tone={u.ton} role={u.ton === "danger" ? "alert" : "status"}>
              {t(u.metin)}
            </p>
          ))}
        </div>
      ) : null}

      {/*
        Sayfada TEK EKRAN (04.11.2026): kartlar kendi içinde kayar, "Kaydet"
        satırı form kartının altına yapışık. Eskiden form sayfayı aşağı
        uzatıyordu ve kaydetmek için dock'un arkasına kadar inmek
        gerekiyordu. Uyarı notu sağ kartın dibine taşındı. Aynı içerik
        pencerede de çiziliyor (etik-penceresi.tsx); orada akış normal.
      */}
      <section className="gb-sutunlar etik-izgara" aria-label={t({ tr: "Etik kurul", en: "Ethics committee" })}>
        <article className="gb-kart gb-sutun">
          <header className="gb-kart-bas">
            <div>
              <h2>{t({ tr: "Başvuru ve karar", en: "Application and decision" })}</h2>
              <p>{t({ tr: "Kurulun kararını tez ve makalenin yöntem bölümüne de yazacaksınız.", en: "You'll also write the committee's decision in the method section of your thesis or article." })}</p>
            </div>
          </header>
          <ActionForm className="project-form-grid" action={etikBilgileriniKaydet} successMessage={t({ tr: "Etik kurul bilgileri kaydedildi.", en: "Ethics details saved." })}>
            <input type="hidden" name="project_id" value={projectId} />
            <label className="project-form-full">
              <span>{t({ tr: "Durum", en: "Status" })}</span>
              <select name="durum" defaultValue={durum}>
                {ETIK_DURUMLARI.map((d) => (
                  <option key={d} value={d}>{t(ETIK_DURUM_ADI[d])}</option>
                ))}
              </select>
            </label>
            <label className="project-form-full">
              <span>{t({ tr: "Etik kurulun adı", en: "Ethics committee name" })}</span>
              <input name="kurulAdi" type="text" maxLength={300} defaultValue={kayit?.kurul_adi ?? ""} placeholder={t({ tr: "Ör. Sosyal ve Beşerî Bilimler Etik Kurulu", en: "e.g. Social Sciences Ethics Committee" })} />
            </label>
            <label>
              <span>{t({ tr: "Başvuru tarihi", en: "Application date" })}</span>
              <TarihSecici name="basvuruTarihi" deger={kayit?.basvuru_tarihi ?? ""} etiket={t({ tr: "Başvuru tarihi", en: "Application date" })} />
            </label>
            <label>
              <span>{t({ tr: "Onay (karar) tarihi", en: "Approval (decision) date" })}</span>
              <TarihSecici name="onayTarihi" deger={kayit?.onay_tarihi ?? ""} etiket={t({ tr: "Onay tarihi", en: "Approval date" })} />
            </label>
            <label>
              <span>{t({ tr: "Karar / protokol sayısı", en: "Decision / protocol number" })}</span>
              <input name="kararNo" type="text" maxLength={120} defaultValue={kayit?.karar_no ?? ""} placeholder={t({ tr: "Ör. 2026/45", en: "e.g. 2026/45" })} />
            </label>
            <label>
              <span>{t({ tr: "Veri toplamaya başlama tarihi", en: "Data collection start date" })}</span>
              <TarihSecici name="veriToplamaBaslangic" deger={kayit?.veri_toplama_baslangic ?? ""} etiket={t({ tr: "Veri toplama başlangıcı", en: "Data collection start" })} />
            </label>
            <label className="project-form-full">
              <span>{t({ tr: "Etik kurul gerekmiyorsa gerekçesi", en: "If not required, why" })}</span>
              <textarea name="gerekmemeGerekcesi" rows={2} maxLength={1000} defaultValue={kayit?.gerekmeme_gerekcesi ?? ""} placeholder={t({ tr: "Ör. Yalnızca kamuya açık, kimliksiz ikincil veri kullanılıyor.", en: "e.g. Only public, de-identified secondary data is used." })} />
            </label>
            <label className="project-form-full">
              <span>{t({ tr: "Notlar", en: "Notes" })}</span>
              <textarea name="notlar" rows={3} maxLength={4000} defaultValue={kayit?.notlar ?? ""} placeholder={t({ tr: "Kurulun istediği düzeltmeler, toplantı tarihi…", en: "Revisions requested by the committee, meeting date…" })} />
            </label>
            <div className="project-form-full cluster etik-kaydet">
              <button type="submit" className="projects-primary-button">{t({ tr: "Kaydet", en: "Save" })}</button>
            </div>
          </ActionForm>
        </article>

        <article className="gb-kart gb-sutun">
          <header className="gb-kart-bas">
            <div>
              <h2>{t({ tr: "Başvuru belgeleri", en: "Application documents" })}</h2>
              <p>{t({ tr: "Her kurulun istediği farklıdır; liste kurulunuzun yönergesinden çıkar.", en: "Each committee asks for different things; the list comes from your committee's guideline." })}</p>
            </div>
          </header>
          <EtikBelgeleri projectId={projectId} baslangic={belgeler} yonergeAdi={kayit?.yonerge_adi ?? null} />
          <aside className="etik-not">
            <ShieldCheck size={16} aria-hidden="true" />
            <p>
              {t({
                tr: "Başvuru formunu, araştırma protokolünü ve onam formunu siz yazarsınız; ArvoLab bu belgeleri yazmaz ve kurulun kararı hakkında öngörüde bulunmaz. Onam formunuza ya da başvurunuza bir uzmanın bakmasını isterseniz ",
                en: "You write the application form, research protocol and consent form; ArvoLab doesn't write these documents or predict the committee's decision. If you'd like an expert to review your consent form or application, ",
              })}
              <Link href="/dashboard/expert-requests">
                <LifeBuoy size={13} aria-hidden="true" /> {t({ tr: "Destek'ten uzmana sorun", en: "ask an expert via Support" })}
              </Link>
              .
            </p>
          </aside>
        </article>
      </section>

    </>
  );
}
