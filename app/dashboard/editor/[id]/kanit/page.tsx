import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, CircleDashed, ExternalLink, Plus, SearchCheck, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  insanIncelemesiYapildi,
  kanitDegerlendirmesiKaydet,
  kanitEkle,
  kanitGuncelle,
  kanitMatrisiOku,
  kanitMetniKaydet,
  kanitNotlariKaydet,
  kanitSil,
  kunyeyiDogrula,
} from "@/app/actions/kanit";
import { kanitAsistaniAcik } from "@/app/actions/ai-kanit";
import {
  DESTEK_ACIKLAMASI,
  DESTEK_ETIKETI,
  DESTEK_TONU,
  KUNYE_ETIKETI,
  durumRozetleri,
  gecerliDestek,
  kanitZinciri,
  matrisOzeti,
  sonrakiAdim,
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
  KANIT MATRİSİ: çalışmanın önemli iddiaları, kaynakları ve kanıt durumları.

  Kullanıcı bir iddiayı açtığında zinciri görür:
    iddia → metin içi atıf → kaynak kaydı → özgün yayın → kanıt → sonuç
  Eksik halka eksik yazılır; tahminle doldurulmaz (lib/kanit/durum.ts).

  Destek düzeyleri otomatik sistemin ya da kullanıcının değerlendirmesidir,
  nihai akademik hüküm değildir; sayfanın başında ve her otomatik hükmün
  yanında bu söyleniyor.
*/

const HUKUMLER: DestekDuzeyi[] = ["dogrudan", "kismen", "dolayli", "celisiyor", "dogrulanamadi"];
const ALAN_ETIKETI: Record<AlanKarsilastirmasi["sonuc"], string> = {
  eslesti: "eşleşti",
  farkli: "uyuşmuyor",
  bizde_yok: "kaydınızda yok",
  kayitta_yok: "dizinde yok",
};

const kunyeMetni = (kaynak: KaynakOzeti | undefined) =>
  kaynak ? [kaynak.authors, kaynak.year ? `(${kaynak.year})` : null, kaynak.title].filter(Boolean).join(" ") : null;

function KaynakSecimi({ kaynaklar, secili }: { kaynaklar: KaynakOzeti[]; secili?: string | null }) {
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

function KanitKarti({
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
    <details className="kanit-kart" id={`iddia-${kayit.id}`}>
      <summary>
        <h3 className="kanit-kart-baslik">{kayit.iddia}</h3>
        <div className="kanit-rozetler">
          {rozetler.map((r) => (
            <span key={r.anahtar} className="status-pill" data-tone={r.ton} title={r.aciklama}>
              {r.etiket}
            </span>
          ))}
          {rozetler.length === 0 && <span className="status-pill" data-tone="neutral">Henüz kontrol yapılmadı</span>}
        </div>
      </summary>

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

        <PanelDrawer
          triggerLabel={kayit.incelenen_metin ? "Kanıt metnini düzenle" : "Kaynaktan metin ekle"}
          triggerClassName="projects-filter-button button-compact"
          kicker="Kanıt"
          title="Kaynaktan incelenen metin"
          description="Kaynağın iddiayla ilgili bölümünü yapıştırın. Sistem yalnızca buraya eklenen metne bakar; sayfa numarasını siz yazarsınız, tahmin edilmez."
        >
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
        </PanelDrawer>

        <PanelDrawer
          triggerLabel="Kendim değerlendireyim"
          triggerClassName="projects-filter-button button-compact"
          kicker="Kanıt"
          title="İddia–kanıt uyumu"
          description="Doğrudan, kısmen, dolaylı ya da çelişiyor diyebilmek için önce metni ve alıntıyı eklemelisiniz; kanıt yoksa söylenebilecek tek şey “doğrulanamadı”dır."
        >
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
        </PanelDrawer>

        {kayit.degerlendiren === "asistan" && kayit.insan_incelemesi !== "yapildi" && (
          <ActionForm action={insanIncelemesiYapildi} successMessage="İnceleme kaydedildi.">
            <input type="hidden" name="id" value={kayit.id} />
            <input type="hidden" name="project_id" value={projectId} />
            <button type="submit" className="projects-filter-button button-compact">
              <Check size={14} aria-hidden="true" /> Kontrol ettim
            </button>
          </ActionForm>
        )}

        <PanelDrawer
          triggerLabel="Matris notları"
          triggerClassName="projects-filter-button button-compact"
          kicker="Kanıt matrisi"
          title="Çelişen çalışmalar, eksik kanıt, düzeltme"
        >
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
        </PanelDrawer>

        <PanelDrawer triggerLabel="Düzenle" triggerClassName="projects-filter-button button-compact" kicker="Kanıt matrisi" title="İddiayı düzenle" description="İddia ya da kaynak değişirse önceki doğrulama sonuçları sıfırlanır.">
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
        </PanelDrawer>

        <ActionForm action={kanitSil} confirmMessage="Bu iddia ve kanıt kaydı silinsin mi?">
          <input type="hidden" name="id" value={kayit.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <button type="submit" className="projects-filter-button button-compact button-danger">Sil</button>
        </ActionForm>
      </div>
    </details>
  );
}

export default async function KanitMatrisiSayfasi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: calisma, error } = await supabase.from("academic_projects").select("id, title, project_type").eq("id", id).maybeSingle();
  if (error) {
    return (
      <main className="dashboard-page">
        <p className="alert" role="alert">Çalışma okunamadı. Kaydınız yerinde duruyor; sayfayı yenileyin.</p>
      </main>
    );
  }
  if (!calisma) notFound();

  const [{ kayitlar, kaynaklar, okunamadi }, asistanAcik] = await Promise.all([kanitMatrisiOku(id), kanitAsistaniAcik()]);
  const kaynakHaritasi = new Map(kaynaklar.map((k) => [k.id, k]));
  const ozet = matrisOzeti(kayitlar);

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Kanıt matrisi</span>
          <h1>{calisma.title}</h1>
          <p>
            Önemli iddialarınızı, dayandıkları kaynakları ve kanıt durumlarını tek yerde izleyin. Destek düzeyleri
            otomatik sistemin ya da sizin değerlendirmenizdir; nihai akademik hüküm değildir.
          </p>
        </div>
        <div className="merkez-ust-eylemler">
          <Link href={`/dashboard/editor/${id}`} className="projects-filter-button">
            <ArrowLeft size={16} aria-hidden="true" /> Çalışma merkezi
          </Link>
          <PanelDrawer
            triggerLabel="İddia ekle"
            triggerIcon={<Plus size={16} aria-hidden="true" />}
            triggerClassName="projects-primary-button"
            kicker="Kanıt matrisi"
            title="Yeni iddia"
            description="Çalışmanızda kaynakla desteklenmesi gereken bir iddia. Kaynak listenizden bağlayın; künye ve kanıt kontrolleri ayrı ayrı yapılır."
          >
            <ActionForm className="project-form-grid" action={kanitEkle} successMessage="İddia eklendi.">
              <input type="hidden" name="project_id" value={id} />
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
                <button type="submit" className="projects-primary-button">Ekle</button>
              </div>
            </ActionForm>
          </PanelDrawer>
        </div>
      </section>

      {okunamadi && (
        <p className="alert mb-md" role="alert">
          Kanıt kayıtları ya da kaynak listesi okunamadı; aşağıdaki liste eksik olabilir. Sayfayı yenileyin.
        </p>
      )}

      <section className="merkez-ozet">
        <article className="merkez-kutu">
          <small>İddia</small>
          <strong>{ozet.toplam}</strong>
          <span>{ozet.dogrudan} doğrudan destekleniyor</span>
        </article>
        <article className="merkez-kutu">
          <small>Bakılması gereken</small>
          <strong>{ozet.celisen + ozet.zayif + ozet.degerlendirilmemis}</strong>
          <span>
            {ozet.celisen} çelişen · {ozet.zayif} kısmi/dolaylı · {ozet.degerlendirilmemis} değerlendirilmedi
          </span>
        </article>
        <article className="merkez-kutu">
          <small>İnsan incelemesi</small>
          <strong>{ozet.incelemeBekleyen}</strong>
          <span>{ozet.kunyeSorunlu} kaynakta künye sorunu</span>
        </article>
      </section>

      {kayitlar.length === 0 ? (
        <section className="empty-state mt-lg">
          <p className="empty-state-baslik">Matriste henüz iddia yok</p>
          <p className="muted">
            Çalışmanızın kaynak gerektiren temel iddialarını ekleyin. Her iddia için künye doğrulaması, kaynaktan
            incelenen metin ve iddia–kanıt uyumu ayrı ayrı kaydedilir.
          </p>
        </section>
      ) : (
        <>
          <section className="section mt-lg">
            <h2 className="section-title">Matris</h2>
            <div className="kanit-matris-sarici">
              <table className="kanit-matris">
                <thead>
                  <tr>
                    <th>İddia</th>
                    <th>Bölüm</th>
                    <th>Kaynak</th>
                    <th>Kaynak doğrulaması</th>
                    <th>Kanıt konumu</th>
                    <th>Destek düzeyi</th>
                    <th>Çelişen çalışmalar</th>
                    <th>Eksik kanıt</th>
                    <th>Önerilen düzeltme</th>
                  </tr>
                </thead>
                <tbody>
                  {kayitlar.map((k) => {
                    const destek = gecerliDestek(k);
                    return (
                      <tr key={k.id}>
                        <td>
                          <a href={`#iddia-${k.id}`}>{k.iddia.length > 160 ? `${k.iddia.slice(0, 160)}…` : k.iddia}</a>
                        </td>
                        <td>{k.bolum ?? "—"}</td>
                        <td>{kunyeMetni(kaynakHaritasi.get(k.kaynak_id ?? "")) ?? (k.kaynak_id ? "Erişilemiyor" : "Bağlanmadı")}</td>
                        <td>{KUNYE_ETIKETI[k.kunye_durumu]}</td>
                        <td>{k.alinti ? k.konum ?? "Konum belirtilmedi" : "—"}</td>
                        <td>
                          <span className="status-pill" data-tone={DESTEK_TONU[destek]}>{DESTEK_ETIKETI[destek]}</span>
                          {k.degerlendiren === "asistan" && <small>otomatik</small>}
                        </td>
                        <td>{k.celisen ?? "—"}</td>
                        <td>{k.eksik_kanit ?? "—"}</td>
                        <td>{sonrakiAdim(k)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Kanıt zincirleri</h2>
            <p className="muted text-base">
              Bir iddiayı açın: akademik iddia → metin içi atıf → kaynak kaydı → özgün yayın → ilgili kanıt → doğrulama
              sonucu. Eksik halkalar kesik çizgiyle gösterilir.
            </p>
            <div className="mt-md">
              {kayitlar.map((k) => (
                <KanitKarti
                  key={k.id}
                  kayit={k}
                  kaynak={kaynakHaritasi.get(k.kaynak_id ?? "") ?? null}
                  projectId={id}
                  asistanAcik={asistanAcik}
                  kaynaklar={kaynaklar}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
