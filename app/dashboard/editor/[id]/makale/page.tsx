import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, ListChecks, Mail, Microscope, Search, Settings2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { makaleProfiliKaydet, makaleProfiliOku } from "@/app/actions/makale";
import { makaleAsistaniAcik } from "@/app/actions/ai-makale";
import { kanitMatrisiOku } from "@/app/actions/kanit";
import { taramaGunlugu } from "@/app/actions/literatur-arama";
import { makaleBolumleri } from "@/lib/makale/bolumler";
import { gonderimKontrolu, type MakaleProfili } from "@/lib/makale/gonderim-kontrolu";
import {
  EQUATOR_ADRESI,
  MAKALE_TURLERI,
  MAKALE_TURU_SIRASI,
  STANDART_UYARISI,
  YONTEM_DENETIMLERI,
  bolumAdi,
  yontemAilesi,
} from "@/lib/makale/sablonlar";
import { denetimListesi } from "@/lib/ai/makale-denetimi";
import { matrisOzeti } from "@/lib/kanit/durum";
import ActionForm from "@/app/dashboard/action-form";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import { trTarihSaat } from "@/lib/tr-time";
import MakaleAsistani from "./makale-asistani";
import CalismaSekmeleri from "../calisma-sekmeleri";

/*
  MAKALE ÇALIŞMA ALANI.

  Tez çalışma merkezinden AYRI bir sayfa ama aynı çalışma satırı: kaynak,
  kaynakça, analiz ve kanıt matrisi ortak altyapıdan geliyor. Makaleye
  özgü olanlar burada: tür ve şablon, hedef dergi ve sınırlar, gönderim
  öncesi kontrol, bölüm denetimi ve tarama günlüğü.

  Söylenmeyenler bilerek söylenmiyor: kabul olasılığı, "dergiye uygun"
  hükmü ve derginin güncel kuralları. ArvoLab dergi bilgisini bir dizinden
  doğrulamıyor; kullanıcının kendi kontrol tarihini kaydedip
  eskidiğinde hatırlatıyor.
*/

const VARSAYILAN_PROFIL: MakaleProfili = {
  makale_turu: "ozgun",
  arastirma_sorusu: null,
  arastirma_problemi: null,
  hedef_dergi: null,
  dergi_kurallari_adresi: null,
  dergi_kurallari_kontrol: null,
  dil: "tr",
  kelime_siniri: null,
  ozet_siniri: null,
  anahtar_en_az: null,
  anahtar_en_cok: null,
  ozet: null,
  anahtar_kelimeler: [],
  veri_durumu: "yok",
  raporlama_standardi: null,
};

const MADDE_TONU = { tamam: "success", eksik: "danger", dikkat: "warning", bilgi: "info" } as const;
const MADDE_ETIKETI = { tamam: "Tamam", eksik: "Eksik", dikkat: "Bakılacak", bilgi: "Not" } as const;

const KAPAK_MEKTUBU = [
  "Derginin ve editörün adı; makalenin başlığı ve türü",
  "Çalışmanın neyi ele aldığı ve alana katkısı — kendi cümlelerinizle",
  "Makalenin özgün olduğu ve başka bir yerde değerlendirmede olmadığı beyanı",
  "Etik kurul onayı, aydınlatılmış onam (gerekiyorsa)",
  "Çıkar çatışması ve finansman beyanı",
  "Derginin istediği ek bilgiler (ör. önerilen hakemler, veri paylaşım beyanı)",
];

export default async function MakaleCalismaAlani({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sorgu] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: calisma, error } = await supabase
    .from("academic_projects")
    .select("id, title, project_type, research_method")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return (
      <main className="dashboard-page">
        <p className="alert" role="alert">Çalışma okunamadı. Kaydınız yerinde duruyor; sayfayı yenileyin.</p>
      </main>
    );
  }
  if (!calisma) notFound();

  if (calisma.project_type !== "article") {
    return (
      <main className="dashboard-page">
        <article className="resume-card">
          <span className="dashboard-kicker">Makale çalışma alanı</span>
          <div className="resume-heading">
            <h2>Bu çalışma makale türünde değil</h2>
            <p>Makale çalışma alanı makale türündeki çalışmalar içindir. Türü çalışma ayarlarından değiştirebilirsiniz.</p>
          </div>
          <div className="cluster">
            <Link href={`/dashboard/editor/${id}`} className="projects-filter-button">Çalışma özeti</Link>
            <Link href={`/dashboard/editor/${id}/edit`} className="projects-filter-button">Çalışma ayarları</Link>
          </div>
        </article>
      </main>
    );
  }

  const [{ profil: kayitliProfil, okunamadi: profilOkunamadi }, matris, gunluk, musvedde, asistanAcik] = await Promise.all([
    makaleProfiliOku(id),
    kanitMatrisiOku(id),
    taramaGunlugu(id, 20),
    supabase.from("project_manuscripts").select("content, updated_at").eq("project_id", id).maybeSingle(),
    makaleAsistaniAcik(),
  ]);

  const profil: MakaleProfili = kayitliProfil ?? VARSAYILAN_PROFIL;
  const tur = MAKALE_TURLERI[profil.makale_turu];
  const bolumler = makaleBolumleri(musvedde.data?.content);
  const kanitOzeti = matrisOzeti(matris.kayitlar);
  const bugun = new Date().toISOString().slice(0, 10);
  const maddeler = gonderimKontrolu({ profil, bolumler, kanit: kanitOzeti, bugun });
  const aile = yontemAilesi(calisma.research_method, profil.makale_turu);

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Makale çalışma alanı · {tur.etiket}</span>
          <h1>{calisma.title}</h1>
          <p>
            {profil.hedef_dergi ? `Hedef: ${profil.hedef_dergi}` : "Hedef dergi seçilmedi"}
            {profil.arastirma_sorusu ? ` · ${profil.arastirma_sorusu}` : ""}
          </p>
        </div>
        <div className="merkez-ust-eylemler">
          <PanelDrawer
            triggerLabel={kayitliProfil ? "Makale bilgileri" : "Makale bilgilerini girin"}
            triggerIcon={<Settings2 size={16} aria-hidden="true" />}
            triggerClassName={kayitliProfil ? "projects-filter-button" : "projects-primary-button"}
            kicker="Makale"
            title="Makale bilgileri"
            description="Tür, araştırma sorusu ve hedef derginin sınırları. Dergi bilgilerini derginin kendi sayfasından kontrol edin; ArvoLab bunları doğrulamıyor."
            /* Yeni makale buraya ?dergi=1 ile geliyor (createProject): kılavuzun
               makaledeki karşılığı derginin kuralları, ilk iş onları girmek. */
            acikBasla={sorgu.dergi === "1" && !kayitliProfil}
          >
            <ActionForm className="project-form-grid" action={makaleProfiliKaydet} successMessage="Makale bilgileri kaydedildi.">
              <input type="hidden" name="project_id" value={id} />
              <label>
                <span>Makale türü</span>
                <select name="makale_turu" defaultValue={profil.makale_turu}>
                  {MAKALE_TURU_SIRASI.map((t) => (
                    <option key={t} value={t}>{MAKALE_TURLERI[t].etiket}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Makale dili</span>
                <select name="dil" defaultValue={profil.dil}>
                  <option value="tr">Türkçe</option>
                  <option value="en">İngilizce</option>
                  <option value="diger">Diğer</option>
                </select>
              </label>
              <label className="project-form-full">
                <span>Araştırma problemi</span>
                <textarea name="arastirma_problemi" rows={2} maxLength={2000} defaultValue={profil.arastirma_problemi ?? ""} />
              </label>
              <label className="project-form-full">
                <span>Araştırma sorusu</span>
                <textarea name="arastirma_sorusu" rows={2} maxLength={1000} defaultValue={profil.arastirma_sorusu ?? ""} />
              </label>
              <label>
                <span>Araştırma tasarımı</span>
                <input name="arastirma_tasarimi" type="text" maxLength={500} defaultValue={kayitliProfil?.arastirma_tasarimi ?? ""} placeholder="Kesitsel, yarı deneysel, fenomenoloji…" />
              </label>
              <label>
                <span>Hedef disiplin</span>
                <input name="disiplin" type="text" maxLength={200} defaultValue={kayitliProfil?.disiplin ?? ""} />
              </label>
              <label>
                <span>Hedef dergi / yayın</span>
                <input name="hedef_dergi" type="text" maxLength={300} defaultValue={profil.hedef_dergi ?? ""} />
              </label>
              <label>
                <span>Yazım kuralları adresi</span>
                <input name="dergi_kurallari_adresi" type="url" maxLength={1000} defaultValue={profil.dergi_kurallari_adresi ?? ""} placeholder="https://" />
              </label>
              <label>
                <span>Kuralları kontrol ettiğim tarih</span>
                <input name="dergi_kurallari_kontrol" type="date" defaultValue={profil.dergi_kurallari_kontrol ?? ""} />
              </label>
              <label>
                <span>Raporlama standardı</span>
                <input name="raporlama_standardi" type="text" maxLength={100} defaultValue={profil.raporlama_standardi ?? ""} placeholder={tur.standartlar[0]?.ad ?? ""} />
              </label>
              <label>
                <span>Kelime sınırı</span>
                <input name="kelime_siniri" type="number" min={100} max={100000} defaultValue={profil.kelime_siniri ?? ""} />
              </label>
              <label>
                <span>Özet sınırı (sözcük)</span>
                <input name="ozet_siniri" type="number" min={30} max={2000} defaultValue={profil.ozet_siniri ?? ""} />
              </label>
              <label>
                <span>Anahtar kelime (en az)</span>
                <input name="anahtar_en_az" type="number" min={1} max={20} defaultValue={profil.anahtar_en_az ?? ""} />
              </label>
              <label>
                <span>Anahtar kelime (en çok)</span>
                <input name="anahtar_en_cok" type="number" min={1} max={20} defaultValue={profil.anahtar_en_cok ?? ""} />
              </label>
              <label>
                <span>Veri ve analiz durumu</span>
                <select name="veri_durumu" defaultValue={profil.veri_durumu}>
                  <option value="yok">Veri yok</option>
                  <option value="toplaniyor">Veri toplanıyor</option>
                  <option value="toplandi">Veri toplandı</option>
                  <option value="analiz_edildi">Analiz tamamlandı</option>
                  <option value="gerekmiyor">Veri gerekmiyor (derleme vb.)</option>
                </select>
              </label>
              <label className="project-form-full">
                <span>Özet</span>
                <textarea name="ozet" rows={5} maxLength={8000} defaultValue={profil.ozet ?? ""} />
              </label>
              <label className="project-form-full">
                <span>Anahtar kelimeler (virgülle ayırın)</span>
                <input name="anahtar_kelimeler" type="text" defaultValue={profil.anahtar_kelimeler.join(", ")} />
              </label>
              <label className="project-form-full">
                <span>Dergi kuralları notları</span>
                <textarea name="dergi_kurallari_notu" rows={3} maxLength={4000} defaultValue={kayitliProfil?.dergi_kurallari_notu ?? ""} />
              </label>
              <div className="project-form-actions project-form-full">
                <button type="submit" className="projects-primary-button">Kaydet</button>
              </div>
            </ActionForm>
          </PanelDrawer>
        </div>
      </section>

      <CalismaSekmeleri calisma={calisma} aktif="makale" />

      {profilOkunamadi && (
        <p className="alert mb-md" role="alert">Makale bilgileri okunamadı; aşağıdaki kontroller varsayılanlarla hesaplandı. Sayfayı yenileyin.</p>
      )}
      {!kayitliProfil && !profilOkunamadi && (
        <p className="callout mb-md" data-tone="accent">
          <strong>Makale bilgileri girilmedi.</strong> Tür, araştırma sorusu ve hedef derginin sınırlarını girdiğinizde
          şablon, gönderim kontrolü ve bölüm denetimi bunlara göre kurulur.
        </p>
      )}

      <section className="section">
        <h2 className="section-title">
          <ListChecks size={18} aria-hidden="true" /> Gönderim öncesi kontrol
        </h2>
        <p className="muted text-base">
          Kaydedilmiş müsveddeden ve kanıt matrisinden hesaplanır. Kabul olasılığı ya da dergiye uygunluk hükmü
          verilmez; bunları hiçbir veri doğrulayamaz.
        </p>
        <ul className="asistan-bulgular mt-sm">
          {maddeler.map((m) => (
            <li className="asistan-bulgu" data-tone={MADDE_TONU[m.durum]} key={m.anahtar}>
              <span className="asistan-bulgu-etiket">{MADDE_ETIKETI[m.durum]}</span>
              <span className="asistan-bulgu-metin">
                <b>{m.baslik}</b>
                {m.aciklama}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/*
        ARAÇLAR KAROLARDA (26.10.2026, kurum sahibinin isteği: ArvoOS
        gibi açılır pencereler). Sayfa eskiden yedi bölümü alt alta
        diziyordu; gönderim kontrolü — makalenin asıl sorusu, "gönderebilir
        miyim" — o uzunluğun içinde kayboluyordu. Şimdi sayfada yalnızca o
        duruyor, şablon, yöntem listesi, bölüm denetimi, tarama günlüğü ve
        kapak mektubu ikinci satırında ne içerdiğini söyleyen karolar.
        Dışa aktarma karosu kalktı: "Yazım" sekmesinin kendisi.
      */}
      <section className="section">
        <h2 className="section-title">Araçlar</h2>
        <div className="calisma-karolari">
          <PanelDrawer
            triggerLabel="Bölüm denetimi"
            triggerNote={bolumler.length ? `${bolumler.length} bölüm · asistan` : "Müsveddede başlıklı bölüm yok"}
            triggerIcon={<Sparkles size={18} aria-hidden="true" />}
            triggerClassName="merkez-baglanti"
            kicker="Asistan"
            title="Bölüm denetimi"
            boy="genis"
            basaridaKapan={false}
          >
            <MakaleAsistani
              projectId={id}
              asistanAcik={asistanAcik}
              bolumler={bolumler.map((b, sira) => ({ sira, baslik: b.baslik, sozcuk: b.sozcuk, denetim: denetimListesi(b.tur, aile) }))}
            />
          </PanelDrawer>

          <PanelDrawer
            triggerLabel="Şablon ve bölüm planı"
            triggerNote={`${tur.etiket}${tur.standartlar.length ? ` · ${tur.standartlar.map((st) => st.ad).join(", ")}` : ""}`}
            triggerIcon={<FileText size={18} aria-hidden="true" />}
            triggerClassName="merkez-baglanti"
            kicker="Makale"
            title="Şablon ve bölüm planı"
            boy="genis"
            basaridaKapan={false}
          >
            <p className="muted text-base">
              {tur.aciklama} Bu bir başlangıç planıdır; hedef derginin talimatı farklı bir düzen istiyorsa dergi geçerlidir.
            </p>
            <ul className="makale-plan mt-sm">
              {tur.bolumler.map((b) => {
                const metinde = bolumler.find((x) => x.tur === b);
                return (
                  <li key={b}>
                    <span>{bolumAdi(b, profil.dil)}</span>
                    <span className="status-pill" data-tone={b === "ozet" ? (profil.ozet ? "success" : "neutral") : metinde ? "success" : "neutral"}>
                      {b === "ozet" ? (profil.ozet ? "Makale bilgilerinde" : "Girilmedi") : metinde ? `Metinde · yaklaşık ${metinde.sozcuk} sözcük` : "Metinde başlık yok"}
                    </span>
                  </li>
                );
              })}
            </ul>
            {tur.notlar.length > 0 && (
              <ul className="kanit-alanlar mt-sm">
                {tur.notlar.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            {tur.standartlar.length > 0 && (
              <div className="callout mt-md" data-tone="accent">
                <strong>İlgili olabilecek raporlama standartları</strong>
                <ul className="kanit-alanlar">
                  {tur.standartlar.map((s) => (
                    <li key={s.ad}>
                      <b>{s.ad}</b> — {s.kapsam}
                    </li>
                  ))}
                </ul>
                <p className="callout-body text-sm">
                  {STANDART_UYARISI}{" "}
                  <a className="link-accent" href={EQUATOR_ADRESI} target="_blank" rel="noopener noreferrer">
                    EQUATOR Network <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </p>
              </div>
            )}
          </PanelDrawer>

          {aile && (
            <PanelDrawer
              triggerLabel="Yönteme göre kontrol listesi"
              triggerNote={`${YONTEM_DENETIMLERI[aile].etiket} · ${YONTEM_DENETIMLERI[aile].maddeler.length} madde`}
              triggerIcon={<ListChecks size={18} aria-hidden="true" />}
              triggerClassName="merkez-baglanti"
              kicker="Yöntem"
              title={`${YONTEM_DENETIMLERI[aile].etiket}: kontrol listesi`}
              basaridaKapan={false}
            >
              <p className="muted text-base">
                Asistan yöntem ve bulgular bölümlerini denetlerken bu maddelere bakar. Gerçek analiz sonuçlarının yerine
                tahmin koymaz; analiz çıktısını Analiz modülünde denetletebilirsiniz.
              </p>
              <ul className="kanit-alanlar mt-sm">
                {YONTEM_DENETIMLERI[aile].maddeler.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </PanelDrawer>
          )}

          <PanelDrawer
            triggerLabel="Literatür tarama günlüğü"
            triggerNote={gunluk.okunamadi ? "Okunamadı" : gunluk.satirlar.length ? `Son ${gunluk.satirlar.length} arama` : "Bu çalışmaya bağlı arama yok"}
            triggerIcon={<Search size={18} aria-hidden="true" />}
            triggerClassName="merkez-baglanti"
            kicker="Literatür"
            title="Literatür tarama günlüğü"
            boy="genis"
            basaridaKapan={false}
          >
            <p className="muted text-base">
              Bu çalışma için yapılan aramalar: sorgu, tarih, filtreler ve cevap veren dizinler. Yalnızca OpenAlex ve
              Crossref taranır; bu günlük taramanın kapsamını gösterir, literatürün tamamının tarandığını değil.
            </p>
            {gunluk.okunamadi ? (
              <p className="alert mt-sm" role="alert">Tarama günlüğü okunamadı.</p>
            ) : gunluk.satirlar.length === 0 ? (
              <p className="muted mt-sm">Bu çalışmaya bağlı arama yok.</p>
            ) : (
              <div className="kanit-matris-sarici mt-sm">
                <table className="kanit-matris">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Sorgu</th>
                      <th>Filtreler</th>
                      <th>Cevap veren dizin</th>
                      <th>Gösterilen sonuç</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gunluk.satirlar.map((s) => (
                      <tr key={s.id}>
                        <td>{trTarihSaat(s.olusturuldu)}</td>
                        <td className="mono">{s.sorgu}</td>
                        <td>
                          {[
                            s.filtreler.yilDan ? `${s.filtreler.yilDan}’den` : "",
                            s.filtreler.yilaKadar ? `${s.filtreler.yilaKadar}’e kadar` : "",
                            s.filtreler.yalnizcaAcikErisim ? "yalnızca açık erişim" : "",
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </td>
                        <td>
                          {s.yanit_veren.join(", ") || "Hiçbiri"}
                          {s.ulasilamayan.length ? <small>ulaşılamadı: {s.ulasilamayan.join(", ")}</small> : null}
                        </td>
                        <td>{s.gosterilen_sonuc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Link href={`/dashboard/literature?calisma=${id}`} className="projects-filter-button mt-sm">
              Literatürde ara
            </Link>
          </PanelDrawer>

          <Link href={`/dashboard/editor/${id}/kanit`} className="merkez-baglanti">
            <Microscope size={18} aria-hidden="true" />
            <span>
              <b>Kanıt matrisi</b>
              {kanitOzeti.toplam
                ? `${kanitOzeti.toplam} iddia · ${kanitOzeti.dogrudan} doğrudan · ${kanitOzeti.celisen} çelişen`
                : "Henüz iddia yok"}
            </span>
          </Link>

          <PanelDrawer
            triggerLabel="Kapak mektubu"
            triggerNote="Kontrol listesi"
            triggerIcon={<Mail size={18} aria-hidden="true" />}
            triggerClassName="merkez-baglanti"
            kicker="Gönderim"
            title="Kapak mektubu kontrol listesi"
            basaridaKapan={false}
          >
            <p className="muted text-base">
              Asistan kapak mektubu yazmaz. Derginin talimatına göre mektubunuzda bulunması gerekebilecekler:
            </p>
            <ul className="kanit-alanlar mt-sm">
              {KAPAK_MEKTUBU.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </PanelDrawer>
        </div>
      </section>
    </main>
  );
}
