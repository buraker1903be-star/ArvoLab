import { Check, CircleDashed, ExternalLink, Plus, SearchCheck, TriangleAlert } from "lucide-react";
import {
  insanIncelemesiYapildi,
  kanitDegerlendirmesiKaydet,
  kanitEkle,
  kanitGuncelle,
  kanitMetniKaydet,
  kanitNotlariKaydet,
  kanitSil,
  kunyeyiDogrula,
} from "@/app/actions/kanit";
import {
  DESTEK_ACIKLAMASI_METIN,
  DESTEK_ETIKETI_METIN,
  DESTEK_TONU,
  KUNYE_ETIKETI_METIN,
  durumRozetleri,
  gecerliDestek,
  kanitZinciri,
  type DestekDuzeyi,
  type KanitKaydi,
  type KaynakOzeti,
} from "@/lib/kanit/durum";
import { alanEtiketi, type AlanKarsilastirmasi } from "@/lib/kanit/kunye-karsilastirma";
import type { Metin } from "@/lib/dil";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import ActionForm from "@/app/dashboard/action-form";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import KanitAsistani from "./kanit-asistani";

/*
  KANIT MATRİSİNİN PARÇALARI. İki yerde kullanılıyor: tam sayfa tablo
  (page.tsx) ve Çalışmalarım'daki durum kartından açılan pencere
  (kanit-matrisi-penceresi.tsx). Bir iddianın zinciri ve işlemleri iki
  yerde ayrı yazılsaydı biri güncellenir, öteki unutulurdu.
*/

const HUKUMLER: DestekDuzeyi[] = ["dogrudan", "kismen", "dolayli", "celisiyor", "dogrulanamadi"];
const ALAN_ETIKETI: Record<AlanKarsilastirmasi["sonuc"], Metin> = {
  eslesti: { tr: "eşleşti", en: "matches" },
  farkli: { tr: "uyuşmuyor", en: "does not match" },
  bizde_yok: { tr: "kaydınızda yok", en: "missing from your record" },
  kayitta_yok: { tr: "dizinde yok", en: "missing from the index" },
};

export const kunyeMetni = (kaynak: KaynakOzeti | undefined) =>
  kaynak ? [kaynak.authors, kaynak.year ? `(${kaynak.year})` : null, kaynak.title].filter(Boolean).join(" ") : null;

export async function KaynakSecimi({ kaynaklar, secili }: { kaynaklar: KaynakOzeti[]; secili?: string | null }) {
  const t = await ceviri();
  return (
    <label className="project-form-full">
      <span>{t({ tr: "Kaynak (literatür listenizden)", en: "Source (from your literature list)" })}</span>
      <select name="kaynak_id" defaultValue={secili ?? ""}>
        <option value="">{t({ tr: "Kaynak bağlanmadı", en: "No source linked" })}</option>
        {kaynaklar.map((k) => (
          <option key={k.id} value={k.id}>
            {kunyeMetni(k)?.slice(0, 140)}
          </option>
        ))}
      </select>
    </label>
  );
}

/*
  İDDİANIN PENCERESİ. Eskiden her iddia sayfanın altında ayrı bir kart
  olarak açılıyor ve içinde dört ayrı açılır pencere düğmesi daha
  taşıyordu: matris ile kartlar aynı bilgiyi iki kez gösteriyor, sayfa
  iddia sayısıyla uzuyordu. Şimdi matris tek liste; satırdaki iddiaya
  tıklayınca zincir ve bütün işlemler TEK pencerede (ArvoOS'taki satır →
  pencere düzeni). Formlar pencerenin içinde açılır bölümler: pencere
  içinde pencere açmak odağı ve geri tuşunu karıştırıyordu.

  Pencere kayıttan sonra KAPANMIYOR (basaridaKapan=false): metni ekleyip
  hemen değerlendirmek tek bir oturumun işi.
*/
export async function KanitAyrintisi({
  kayit,
  kaynak,
  projectId,
  asistanAcik,
  kaynaklar,
}: {
  kayit: KanitKaydi;
  kaynak: KaynakOzeti | null;
  projectId: string;
  asistanAcik: boolean;
  kaynaklar: KaynakOzeti[];
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarihSaat } = await tarihler();
  const zincir = kanitZinciri(kayit, kaynak, dil);
  const rozetler = durumRozetleri(kayit, dil);
  const ayrinti = (kayit.kunye_ayrintisi ?? null) as { ozet?: string; alanlar?: AlanKarsilastirmasi[] } | null;
  const destek = gecerliDestek(kayit);

  return (
    <>
      <div className="kanit-rozetler">
        {rozetler.map((r) => (
          <span key={r.anahtar} className="status-pill" data-tone={r.ton} title={r.aciklama}>
            {r.etiket}
          </span>
        ))}
        {rozetler.length === 0 && (
          <span className="status-pill" data-tone="neutral">
            {t({ tr: "Henüz kontrol yapılmadı", en: "No checks yet" })}
          </span>
        )}
      </div>

      <ol className="kanit-zinciri" aria-label={t({ tr: "Kanıt zinciri", en: "Evidence chain" })}>
        {zincir.map((halka) => (
          <li key={halka.anahtar} className="kanit-halka" data-durum={halka.durum}>
            <span className="kanit-halka-simge" aria-hidden="true">
              {halka.durum === "tamam" ? <Check size={16} /> : halka.durum === "kismi" ? <TriangleAlert size={16} /> : <CircleDashed size={16} />}
            </span>
            <span className="kanit-halka-govde">
              <b>{halka.baslik}</b>
              {halka.metin}
              {halka.adres ? (
                <>
                  {" "}
                  <a href={halka.adres} target="_blank" rel="noopener noreferrer">
                    {t({ tr: "Kayıt sayfası", en: "Record page" })} <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      {ayrinti?.ozet && (
        <div className="asistan-bolum">
          <h4 className="asistan-bolum-baslik">
            {t({ tr: "Bibliyografik doğrulama", en: "Bibliographic verification" })} · {t(KUNYE_ETIKETI_METIN[kayit.kunye_durumu])}
            {kayit.kunye_bakildi ? ` · ${tarihSaat(kayit.kunye_bakildi)}` : ""}
          </h4>
          <p className="muted text-sm">{ayrinti.ozet}</p>
          {ayrinti.alanlar && ayrinti.alanlar.length > 0 && (
            <ul className="kanit-alanlar">
              {ayrinti.alanlar.map((a) => (
                <li key={a.alan}>
                  <b>{alanEtiketi(a.alan, dil)}:</b> {t(ALAN_ETIKETI[a.sonuc])}
                  {a.sonuc === "farkli"
                    ? t({ tr: ` — sizde “${a.bizde}”, dizinde “${a.kayitta}”`, en: ` — yours: “${a.bizde}”, index: “${a.kayitta}”` })
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {kayit.erisim_durumu !== "bilinmiyor" && (
        <p className="muted text-sm mt-sm">
          {t({ tr: "Tam metne erişim", en: "Full-text access" })}:{" "}
          {kayit.erisim_durumu === "acik_erisim"
            ? t({ tr: "açık erişimli bir sürüm var (OpenAlex)", en: "an open-access version exists (OpenAlex)" })
            : t({ tr: "açık erişimli sürüm bulunamadı (OpenAlex)", en: "no open-access version found (OpenAlex)" })}
          {kayit.erisim_adresi ? (
            <>
              {" · "}
              <a className="link-accent" href={kayit.erisim_adresi} target="_blank" rel="noopener noreferrer">
                {t({ tr: "Açık erişim sürümü", en: "Open-access version" })}
              </a>
            </>
          ) : null}
          {t({ tr: ". Erişilebilir olması incelendiği anlamına gelmez.", en: ". Being accessible does not mean it has been reviewed." })}
        </p>
      )}

      {kayit.degerlendiren && (
        <div className="asistan-bolum">
          <h4 className="asistan-bolum-baslik">
            {t({ tr: "Uyum değerlendirmesi", en: "Fit assessment" })} ·{" "}
            {kayit.degerlendiren === "asistan" ? t({ tr: "otomatik", en: "automated" }) : t({ tr: "sizin", en: "yours" })}
            {kayit.degerlendirildi ? ` · ${tarihSaat(kayit.degerlendirildi)}` : ""}
          </h4>
          <p className="cluster">
            <span className="status-pill" data-tone={DESTEK_TONU[destek]}>{t(DESTEK_ETIKETI_METIN[destek])}</span>
            <span className="muted text-sm">{t(DESTEK_ACIKLAMASI_METIN[destek])}</span>
          </p>
          {kayit.gerekce && <p className="callout-body text-sm">{kayit.gerekce}</p>}
          {kayit.degerlendiren === "asistan" && (
            <p className="muted text-sm">
              {t({
                tr: "Bu değerlendirmeyi otomatik sistem yaptı; nihai akademik hüküm değildir.",
                en: "This assessment was made by the automated system; it is not a final academic judgment.",
              })}
            </p>
          )}
        </div>
      )}

      <KanitAsistani kanitId={kayit.id} asistanAcik={asistanAcik} metinVar={Boolean(kayit.incelenen_metin)} />

      <div className="kanit-eylemler">
        <ActionForm action={kunyeyiDogrula}>
          <input type="hidden" name="id" value={kayit.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <button type="submit" className="projects-filter-button button-compact" disabled={!kayit.kaynak_id}>
            <SearchCheck size={14} aria-hidden="true" /> {t({ tr: "Künyeyi dizinde doğrula", en: "Verify reference in index" })}
          </button>
        </ActionForm>
        {kayit.degerlendiren === "asistan" && kayit.insan_incelemesi !== "yapildi" && (
          <ActionForm action={insanIncelemesiYapildi} successMessage={t({ tr: "İnceleme kaydedildi.", en: "Review saved." })}>
            <input type="hidden" name="id" value={kayit.id} />
            <input type="hidden" name="project_id" value={projectId} />
            <button type="submit" className="projects-filter-button button-compact">
              <Check size={14} aria-hidden="true" /> {t({ tr: "Kontrol ettim", en: "I checked it" })}
            </button>
          </ActionForm>
        )}
      </div>

      <details className="form-details mt-md" open={!kayit.incelenen_metin}>
        <summary>
          {kayit.incelenen_metin
            ? t({ tr: "Kanıt metnini düzenle", en: "Edit evidence text" })
            : t({ tr: "Kaynaktan metin ekle", en: "Add text from source" })}
        </summary>
        <p className="muted text-sm">
          {t({
            tr: "Kaynağın iddiayla ilgili bölümünü yapıştırın. Sistem yalnızca buraya eklenen metne bakar; sayfa numarasını siz yazarsınız, tahmin edilmez.",
            en: "Paste the part of the source that relates to the claim. The system only looks at the text added here; you enter the page number yourself, it is never guessed.",
          })}
        </p>
        <ActionForm className="project-form-grid" action={kanitMetniKaydet}>
          <input type="hidden" name="id" value={kayit.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <label className="project-form-full">
            <span>{t({ tr: "İncelenen metin", en: "Reviewed text" })}</span>
            <textarea
              name="incelenen_metin"
              rows={8}
              maxLength={20000}
              defaultValue={kayit.incelenen_metin ?? ""}
              placeholder={t({ tr: "Kaynaktan iddiayla ilgili paragraf ya da bölüm", en: "The paragraph or section of the source related to the claim" })}
            />
          </label>
          <label>
            <span>{t({ tr: "Metnin kapsamı", en: "Scope of the text" })}</span>
            <select name="incelenen_kapsam" defaultValue={kayit.incelenen_kapsam ?? "bolum"}>
              <option value="bolum">{t({ tr: "Kaynağın bir bölümü", en: "Part of the source" })}</option>
              <option value="tam_metin">{t({ tr: "Kaynağın tamamı", en: "The entire source" })}</option>
            </select>
          </label>
          <label>
            <span>{t({ tr: "Konum (sayfa, bölüm, tablo)", en: "Location (page, section, table)" })}</span>
            <input name="konum" type="text" maxLength={200} defaultValue={kayit.konum ?? ""} placeholder={t({ tr: "s. 14, Tablo 3", en: "p. 14, Table 3" })} />
          </label>
          <label className="project-form-full">
            <span>{t({ tr: "Metin sürümü", en: "Text version" })}</span>
            <input
              name="incelenen_surum"
              type="text"
              maxLength={300}
              defaultValue={kayit.incelenen_surum ?? ""}
              placeholder={t({ tr: "Yayıncı PDF'i, kabul edilmiş taslak, ön baskı…", en: "Publisher PDF, accepted manuscript, preprint…" })}
            />
          </label>
          <label className="project-form-full">
            <span>{t({ tr: "Kanıt alıntısı (metinden birebir)", en: "Evidence quote (verbatim from the text)" })}</span>
            <textarea
              name="alinti"
              rows={3}
              maxLength={1000}
              defaultValue={kayit.alinti ?? ""}
              placeholder={t({
                tr: "İddiayı destekleyen ya da çürüten cümle; yukarıdaki metinde birebir geçmeli",
                en: "The sentence that supports or refutes the claim; it must appear verbatim in the text above",
              })}
            />
          </label>
          <div className="project-form-actions project-form-full">
            <button type="submit" className="projects-primary-button">{t({ tr: "Kaydet", en: "Save" })}</button>
          </div>
        </ActionForm>
      </details>

      <details className="form-details mt-sm">
        <summary>{t({ tr: "Kendim değerlendireyim", en: "Assess it myself" })}</summary>
        <p className="muted text-sm">
          {t({
            tr: "Doğrudan, kısmen, dolaylı ya da çelişiyor diyebilmek için önce metni ve alıntıyı eklemelisiniz; kanıt yoksa söylenebilecek tek şey “doğrulanamadı”dır.",
            en: "To say direct, partial, indirect or contradicting, you must first add the text and the quote; without evidence, the only possible verdict is “could not be verified”.",
          })}
        </p>
        <ActionForm className="project-form-grid" action={kanitDegerlendirmesiKaydet}>
          <input type="hidden" name="id" value={kayit.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <label className="project-form-full">
            <span>{t({ tr: "Destek düzeyi", en: "Support level" })}</span>
            <select name="destek_duzeyi" defaultValue={destek === "degerlendirilmedi" ? "dogrulanamadi" : destek}>
              {HUKUMLER.map((h) => (
                <option key={h} value={h} disabled={h !== "dogrulanamadi" && !kayit.alinti}>
                  {t(DESTEK_ETIKETI_METIN[h])}
                </option>
              ))}
            </select>
          </label>
          <label className="project-form-full">
            <span>{t({ tr: "Gerekçe", en: "Rationale" })}</span>
            <textarea name="gerekce" rows={3} maxLength={2000} defaultValue={kayit.degerlendiren === "kullanici" ? kayit.gerekce ?? "" : ""} />
          </label>
          <div className="project-form-actions project-form-full">
            <button type="submit" className="projects-primary-button">{t({ tr: "Kaydet", en: "Save" })}</button>
          </div>
        </ActionForm>
      </details>

      <details className="form-details mt-sm">
        <summary>{t({ tr: "Matris notları: çelişen çalışmalar, eksik kanıt, düzeltme", en: "Matrix notes: contradicting studies, missing evidence, fix" })}</summary>
        <ActionForm className="project-form-grid" action={kanitNotlariKaydet}>
          <input type="hidden" name="id" value={kayit.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <label className="project-form-full">
            <span>{t({ tr: "Çelişen çalışmalar", en: "Contradicting studies" })}</span>
            <textarea name="celisen" rows={2} maxLength={1000} defaultValue={kayit.celisen ?? ""} />
          </label>
          <label className="project-form-full">
            <span>{t({ tr: "Eksik kanıt", en: "Missing evidence" })}</span>
            <textarea name="eksik_kanit" rows={2} maxLength={1000} defaultValue={kayit.eksik_kanit ?? ""} />
          </label>
          <label className="project-form-full">
            <span>{t({ tr: "Önerilen düzeltme", en: "Suggested fix" })}</span>
            <textarea name="duzeltme" rows={2} maxLength={1000} defaultValue={kayit.duzeltme ?? ""} />
          </label>
          <div className="project-form-actions project-form-full">
            <button type="submit" className="projects-primary-button">{t({ tr: "Kaydet", en: "Save" })}</button>
          </div>
        </ActionForm>
      </details>

      <details className="form-details mt-sm">
        <summary>{t({ tr: "İddiayı düzenle", en: "Edit claim" })}</summary>
        <p className="muted text-sm">
          {t({ tr: "İddia ya da kaynak değişirse önceki doğrulama sonuçları sıfırlanır.", en: "If the claim or source changes, previous verification results are reset." })}
        </p>
        <ActionForm className="project-form-grid" action={kanitGuncelle}>
          <input type="hidden" name="id" value={kayit.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <label className="project-form-full">
            <span>{t({ tr: "İddia", en: "Claim" })}</span>
            <textarea name="iddia" rows={3} maxLength={2000} required defaultValue={kayit.iddia} />
          </label>
          <label>
            <span>{t({ tr: "Bölüm", en: "Section" })}</span>
            <input name="bolum" type="text" maxLength={200} defaultValue={kayit.bolum ?? ""} />
          </label>
          <label>
            <span>{t({ tr: "Metin içi atıf", en: "In-text citation" })}</span>
            <input name="atif" type="text" maxLength={300} defaultValue={kayit.atif ?? ""} />
          </label>
          <KaynakSecimi kaynaklar={kaynaklar} secili={kayit.kaynak_id} />
          <div className="project-form-actions project-form-full">
            <button type="submit" className="projects-primary-button">{t({ tr: "Kaydet", en: "Save" })}</button>
          </div>
        </ActionForm>
      </details>

      <div className="kanit-eylemler">
        <ActionForm action={kanitSil} confirmMessage={t({ tr: "Bu iddia ve kanıt kaydı silinsin mi?", en: "Delete this claim and its evidence record?" })}>
          <input type="hidden" name="id" value={kayit.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <button type="submit" className="projects-filter-button button-compact button-danger">
            {t({ tr: "İddiayı sil", en: "Delete claim" })}
          </button>
        </ActionForm>
      </div>
    </>
  );
}

export async function KanitPenceresi(props: {
  kayit: KanitKaydi;
  kaynak: KaynakOzeti | null;
  projectId: string;
  asistanAcik: boolean;
  kaynaklar: KaynakOzeti[];
}) {
  const { kayit } = props;
  const t = await ceviri();
  return (
    <PanelDrawer
      triggerLabel={kayit.iddia.length > 160 ? `${kayit.iddia.slice(0, 160)}…` : kayit.iddia}
      triggerClassName="kanit-iddia-dugmesi"
      kicker={kayit.bolum ? t({ tr: `Kanıt zinciri · ${kayit.bolum}`, en: `Evidence chain · ${kayit.bolum}` }) : t({ tr: "Kanıt zinciri", en: "Evidence chain" })}
      title={kayit.iddia}
      boy="genis"
      basaridaKapan={false}
    >
      <KanitAyrintisi {...props} />
    </PanelDrawer>
  );
}



/** Yeni iddia formu: tam sayfadaki pencerede ve kart penceresinin açılır bölümünde aynı form. */
export async function IddiaEkleFormu({ projectId, kaynaklar }: { projectId: string; kaynaklar: KaynakOzeti[] }) {
  const t = await ceviri();
  return (
    <ActionForm className="project-form-grid" action={kanitEkle} successMessage={t({ tr: "İddia eklendi.", en: "Claim added." })}>
      <input type="hidden" name="project_id" value={projectId} />
      <label className="project-form-full">
        <span>{t({ tr: "İddia", en: "Claim" })}</span>
        <textarea name="iddia" rows={3} maxLength={2000} required placeholder={t({ tr: "Çalışmanızdaki iddia cümlesi", en: "The claim sentence in your work" })} />
      </label>
      <label>
        <span>{t({ tr: "Bölüm", en: "Section" })}</span>
        <input name="bolum" type="text" maxLength={200} placeholder={t({ tr: "Giriş, Tartışma…", en: "Introduction, Discussion…" })} />
      </label>
      <label>
        <span>{t({ tr: "Metin içi atıf", en: "In-text citation" })}</span>
        <input name="atif" type="text" maxLength={300} placeholder={t({ tr: "(Yılmaz, 2020, s. 14)", en: "(Smith, 2020, p. 14)" })} />
      </label>
      <KaynakSecimi kaynaklar={kaynaklar} />
      <div className="project-form-actions project-form-full">
        <button type="submit" className="projects-primary-button">
          <Plus size={16} aria-hidden="true" /> {t({ tr: "Ekle", en: "Add" })}
        </button>
      </div>
    </ActionForm>
  );
}
