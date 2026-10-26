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
  DESTEK_ACIKLAMASI,
  DESTEK_ETIKETI,
  DESTEK_TONU,
  KUNYE_ETIKETI,
  durumRozetleri,
  gecerliDestek,
  kanitZinciri,
  type DestekDuzeyi,
  type KanitKaydi,
  type KaynakOzeti,
} from "@/lib/kanit/durum";
import type { AlanKarsilastirmasi } from "@/lib/kanit/kunye-karsilastirma";
import ActionForm from "@/app/dashboard/action-form";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import { trTarihSaat } from "@/lib/tr-time";
import KanitAsistani from "./kanit-asistani";

/*
  KANIT MATRİSİNİN PARÇALARI. İki yerde kullanılıyor: tam sayfa tablo
  (page.tsx) ve Çalışmalarım'daki durum kartından açılan pencere
  (kanit-matrisi-penceresi.tsx). Bir iddianın zinciri ve işlemleri iki
  yerde ayrı yazılsaydı biri güncellenir, öteki unutulurdu.
*/

const HUKUMLER: DestekDuzeyi[] = ["dogrudan", "kismen", "dolayli", "celisiyor", "dogrulanamadi"];
const ALAN_ETIKETI: Record<AlanKarsilastirmasi["sonuc"], string> = {
  eslesti: "eşleşti",
  farkli: "uyuşmuyor",
  bizde_yok: "kaydınızda yok",
  kayitta_yok: "dizinde yok",
};

export const kunyeMetni = (kaynak: KaynakOzeti | undefined) =>
  kaynak ? [kaynak.authors, kaynak.year ? `(${kaynak.year})` : null, kaynak.title].filter(Boolean).join(" ") : null;

export function KaynakSecimi({ kaynaklar, secili }: { kaynaklar: KaynakOzeti[]; secili?: string | null }) {
  return (
    <label className="project-form-full">
      <span>Kaynak (literatür listenizden)</span>
      <select name="kaynak_id" defaultValue={secili ?? ""}>
        <option value="">Kaynak bağlanmadı</option>
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
export function KanitAyrintisi({
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
  const zincir = kanitZinciri(kayit, kaynak);
  const rozetler = durumRozetleri(kayit);
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
        {rozetler.length === 0 && <span className="status-pill" data-tone="neutral">Henüz kontrol yapılmadı</span>}
      </div>

      <ol className="kanit-zinciri" aria-label="Kanıt zinciri">
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
                    Kayıt sayfası <ExternalLink size={12} aria-hidden="true" />
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
            Bibliyografik doğrulama · {KUNYE_ETIKETI[kayit.kunye_durumu]}
            {kayit.kunye_bakildi ? ` · ${trTarihSaat(kayit.kunye_bakildi)}` : ""}
          </h4>
          <p className="muted text-sm">{ayrinti.ozet}</p>
          {ayrinti.alanlar && ayrinti.alanlar.length > 0 && (
            <ul className="kanit-alanlar">
              {ayrinti.alanlar.map((a) => (
                <li key={a.alan}>
                  <b>{a.etiket}:</b> {ALAN_ETIKETI[a.sonuc]}
                  {a.sonuc === "farkli" ? ` — sizde “${a.bizde}”, dizinde “${a.kayitta}”` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {kayit.erisim_durumu !== "bilinmiyor" && (
        <p className="muted text-sm mt-sm">
          Tam metne erişim: {kayit.erisim_durumu === "acik_erisim" ? "açık erişimli bir sürüm var (OpenAlex)" : "açık erişimli sürüm bulunamadı (OpenAlex)"}
          {kayit.erisim_adresi ? (
            <>
              {" · "}
              <a className="link-accent" href={kayit.erisim_adresi} target="_blank" rel="noopener noreferrer">
                Açık erişim sürümü
              </a>
            </>
          ) : null}
          . Erişilebilir olması incelendiği anlamına gelmez.
        </p>
      )}

      {kayit.degerlendiren && (
        <div className="asistan-bolum">
          <h4 className="asistan-bolum-baslik">
            Uyum değerlendirmesi · {kayit.degerlendiren === "asistan" ? "otomatik" : "sizin"}
            {kayit.degerlendirildi ? ` · ${trTarihSaat(kayit.degerlendirildi)}` : ""}
          </h4>
          <p className="cluster">
            <span className="status-pill" data-tone={DESTEK_TONU[destek]}>{DESTEK_ETIKETI[destek]}</span>
            <span className="muted text-sm">{DESTEK_ACIKLAMASI[destek]}</span>
          </p>
          {kayit.gerekce && <p className="callout-body text-sm">{kayit.gerekce}</p>}
          {kayit.degerlendiren === "asistan" && (
            <p className="muted text-sm">Bu değerlendirmeyi otomatik sistem yaptı; nihai akademik hüküm değildir.</p>
          )}
        </div>
      )}

      <KanitAsistani kanitId={kayit.id} asistanAcik={asistanAcik} metinVar={Boolean(kayit.incelenen_metin)} />

      <div className="kanit-eylemler">
        <ActionForm action={kunyeyiDogrula}>
          <input type="hidden" name="id" value={kayit.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <button type="submit" className="projects-filter-button button-compact" disabled={!kayit.kaynak_id}>
            <SearchCheck size={14} aria-hidden="true" /> Künyeyi dizinde doğrula
          </button>
        </ActionForm>
        {kayit.degerlendiren === "asistan" && kayit.insan_incelemesi !== "yapildi" && (
          <ActionForm action={insanIncelemesiYapildi} successMessage="İnceleme kaydedildi.">
            <input type="hidden" name="id" value={kayit.id} />
            <input type="hidden" name="project_id" value={projectId} />
            <button type="submit" className="projects-filter-button button-compact">
              <Check size={14} aria-hidden="true" /> Kontrol ettim
            </button>
          </ActionForm>
        )}
      </div>

      <details className="form-details mt-md" open={!kayit.incelenen_metin}>
        <summary>{kayit.incelenen_metin ? "Kanıt metnini düzenle" : "Kaynaktan metin ekle"}</summary>
        <p className="muted text-sm">
        Kaynağın iddiayla ilgili bölümünü yapıştırın. Sistem yalnızca buraya eklenen metne bakar; sayfa numarasını
        siz yazarsınız, tahmin edilmez.
        </p>
        <ActionForm className="project-form-grid" action={kanitMetniKaydet}>
          <input type="hidden" name="id" value={kayit.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <label className="project-form-full">
            <span>İncelenen metin</span>
            <textarea name="incelenen_metin" rows={8} maxLength={20000} defaultValue={kayit.incelenen_metin ?? ""} placeholder="Kaynaktan iddiayla ilgili paragraf ya da bölüm" />
          </label>
          <label>
            <span>Metnin kapsamı</span>
            <select name="incelenen_kapsam" defaultValue={kayit.incelenen_kapsam ?? "bolum"}>
              <option value="bolum">Kaynağın bir bölümü</option>
              <option value="tam_metin">Kaynağın tamamı</option>
            </select>
          </label>
          <label>
            <span>Konum (sayfa, bölüm, tablo)</span>
            <input name="konum" type="text" maxLength={200} defaultValue={kayit.konum ?? ""} placeholder="s. 14, Tablo 3" />
          </label>
          <label className="project-form-full">
            <span>Metin sürümü</span>
            <input name="incelenen_surum" type="text" maxLength={300} defaultValue={kayit.incelenen_surum ?? ""} placeholder="Yayıncı PDF'i, kabul edilmiş taslak, ön baskı…" />
          </label>
          <label className="project-form-full">
            <span>Kanıt alıntısı (metinden birebir)</span>
            <textarea name="alinti" rows={3} maxLength={1000} defaultValue={kayit.alinti ?? ""} placeholder="İddiayı destekleyen ya da çürüten cümle; yukarıdaki metinde birebir geçmeli" />
          </label>
          <div className="project-form-actions project-form-full">
            <button type="submit" className="projects-primary-button">Kaydet</button>
          </div>
        </ActionForm>
      </details>

      <details className="form-details mt-sm">
        <summary>Kendim değerlendireyim</summary>
        <p className="muted text-sm">
        Doğrudan, kısmen, dolaylı ya da çelişiyor diyebilmek için önce metni ve alıntıyı eklemelisiniz; kanıt yoksa
        söylenebilecek tek şey “doğrulanamadı”dır.
        </p>
        <ActionForm className="project-form-grid" action={kanitDegerlendirmesiKaydet}>
          <input type="hidden" name="id" value={kayit.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <label className="project-form-full">
            <span>Destek düzeyi</span>
            <select name="destek_duzeyi" defaultValue={destek === "degerlendirilmedi" ? "dogrulanamadi" : destek}>
              {HUKUMLER.map((h) => (
                <option key={h} value={h} disabled={h !== "dogrulanamadi" && !kayit.alinti}>
                  {DESTEK_ETIKETI[h]}
                </option>
              ))}
            </select>
          </label>
          <label className="project-form-full">
            <span>Gerekçe</span>
            <textarea name="gerekce" rows={3} maxLength={2000} defaultValue={kayit.degerlendiren === "kullanici" ? kayit.gerekce ?? "" : ""} />
          </label>
          <div className="project-form-actions project-form-full">
            <button type="submit" className="projects-primary-button">Kaydet</button>
          </div>
        </ActionForm>
      </details>

      <details className="form-details mt-sm">
        <summary>Matris notları: çelişen çalışmalar, eksik kanıt, düzeltme</summary>
        <ActionForm className="project-form-grid" action={kanitNotlariKaydet}>
          <input type="hidden" name="id" value={kayit.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <label className="project-form-full">
            <span>Çelişen çalışmalar</span>
            <textarea name="celisen" rows={2} maxLength={1000} defaultValue={kayit.celisen ?? ""} />
          </label>
          <label className="project-form-full">
            <span>Eksik kanıt</span>
            <textarea name="eksik_kanit" rows={2} maxLength={1000} defaultValue={kayit.eksik_kanit ?? ""} />
          </label>
          <label className="project-form-full">
            <span>Önerilen düzeltme</span>
            <textarea name="duzeltme" rows={2} maxLength={1000} defaultValue={kayit.duzeltme ?? ""} />
          </label>
          <div className="project-form-actions project-form-full">
            <button type="submit" className="projects-primary-button">Kaydet</button>
          </div>
        </ActionForm>
      </details>

      <details className="form-details mt-sm">
        <summary>İddiayı düzenle</summary>
        <p className="muted text-sm">İddia ya da kaynak değişirse önceki doğrulama sonuçları sıfırlanır.</p>
        <ActionForm className="project-form-grid" action={kanitGuncelle}>
          <input type="hidden" name="id" value={kayit.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <label className="project-form-full">
            <span>İddia</span>
            <textarea name="iddia" rows={3} maxLength={2000} required defaultValue={kayit.iddia} />
          </label>
          <label>
            <span>Bölüm</span>
            <input name="bolum" type="text" maxLength={200} defaultValue={kayit.bolum ?? ""} />
          </label>
          <label>
            <span>Metin içi atıf</span>
            <input name="atif" type="text" maxLength={300} defaultValue={kayit.atif ?? ""} />
          </label>
          <KaynakSecimi kaynaklar={kaynaklar} secili={kayit.kaynak_id} />
          <div className="project-form-actions project-form-full">
            <button type="submit" className="projects-primary-button">Kaydet</button>
          </div>
        </ActionForm>
      </details>

      <div className="kanit-eylemler">
        <ActionForm action={kanitSil} confirmMessage="Bu iddia ve kanıt kaydı silinsin mi?">
          <input type="hidden" name="id" value={kayit.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <button type="submit" className="projects-filter-button button-compact button-danger">İddiayı sil</button>
        </ActionForm>
      </div>
    </>
  );
}

export function KanitPenceresi(props: {
  kayit: KanitKaydi;
  kaynak: KaynakOzeti | null;
  projectId: string;
  asistanAcik: boolean;
  kaynaklar: KaynakOzeti[];
}) {
  const { kayit } = props;
  return (
    <PanelDrawer
      triggerLabel={kayit.iddia.length > 160 ? `${kayit.iddia.slice(0, 160)}…` : kayit.iddia}
      triggerClassName="kanit-iddia-dugmesi"
      kicker={kayit.bolum ? `Kanıt zinciri · ${kayit.bolum}` : "Kanıt zinciri"}
      title={kayit.iddia}
      boy="genis"
      basaridaKapan={false}
    >
      <KanitAyrintisi {...props} />
    </PanelDrawer>
  );
}



/** Yeni iddia formu: tam sayfadaki pencerede ve kart penceresinin açılır bölümünde aynı form. */
export function IddiaEkleFormu({ projectId, kaynaklar }: { projectId: string; kaynaklar: KaynakOzeti[] }) {
  return (
    <ActionForm className="project-form-grid" action={kanitEkle} successMessage="İddia eklendi.">
      <input type="hidden" name="project_id" value={projectId} />
      <label className="project-form-full">
        <span>İddia</span>
        <textarea name="iddia" rows={3} maxLength={2000} required placeholder="Çalışmanızdaki iddia cümlesi" />
      </label>
      <label>
        <span>Bölüm</span>
        <input name="bolum" type="text" maxLength={200} placeholder="Giriş, Tartışma…" />
      </label>
      <label>
        <span>Metin içi atıf</span>
        <input name="atif" type="text" maxLength={300} placeholder="(Yılmaz, 2020, s. 14)" />
      </label>
      <KaynakSecimi kaynaklar={kaynaklar} />
      <div className="project-form-actions project-form-full">
        <button type="submit" className="projects-primary-button">
          <Plus size={16} aria-hidden="true" /> Ekle
        </button>
      </div>
    </ActionForm>
  );
}
