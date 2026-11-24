"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UploadCloud, Link2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { kilavuzuKaydet, kilavuzuTara, type TaramaSonucu } from "@/app/actions/calisma-kilavuzu";
import StilSecici from "@/app/dashboard/_components/stil-secici";
import { dogrulamaMesaji, formuDogrula, type DogrulamaFormu } from "@/lib/kilavuz-dogrulama";
import { stilAdiMetni } from "@/lib/atif/stiller";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";

/*
  ÖĞRENCİNİN KENDİ KILAVUZUNU YÜKLEMESİ (26.10.2026).

  Öğrencinin durumu: kurumunun kılavuzu katalogda yok, elinde
  danışmanının attığı bir PDF var. "Atıf stili" soyut olarak ne demek
  bilmiyor ama kılavuzunda yazanı görebiliyor. Ekran buna göre kuruldu:

  - BEKLEME DÜRÜSTÇE SÖYLENİYOR. Taranmış bir PDF'te OCR yarım dakikayı
    buluyor (ölçüldü: sayfa başına 2,5–4 sn). Donmuş bir düğmeye bakan
    öğrenci bozuldu sanır; her adım yazıyla söyleniyor.

  - FORM DUVARI YOK. Üç şey soruluyor: atıf stili, zorunlu bölümler,
    sayfa aralığı. Bölümler yazı alanı değil, silinebilir etiketler —
    çıkarımın bulduğu on beş bölümü elle yeniden yazmak kimsenin işi
    değil.

  - "YANLIŞ YAPARIM" KORKUSU GİDERİLİYOR. Bulunamayan alan boş değil,
    "bulamadım" diyor; ekranda kuralların sonradan değiştirilebildiği
    ve bunun resmî bir onay OLMADIĞI yazıyor.
*/

type Adim = "secim" | "tarama" | "dogrulama" | "okunamadi";

export default function KilavuzYukle({ projectId, onKapat }: { projectId: string; onKapat?: () => void }) {
  const t = useCeviri();
  const dil = useDil();
  const [adim, setAdim] = useState<Adim>("secim");
  const [durum, setDurum] = useState("");
  const [adres, setAdres] = useState("");
  const [sonuc, setSonuc] = useState<TaramaSonucu | null>(null);
  const [form, setForm] = useState<DogrulamaFormu | null>(null);
  const [yeniBolum, setYeniBolum] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [stilEksik, setStilEksik] = useState(false);
  const stilKutusu = useRef<HTMLSelectElement>(null);
  const router = useRouter();

  const taramayiBitir = (cevap: TaramaSonucu) => {
    /*
      Metni çıkarılamayan belge: toast gösterip seçim ekranına dönmek
      öğrenciyi "ne oldu, ne yapacağım?" sorusuyla bırakıyordu. Kalıcı
      bir ekran, sebebi ve İKİ çıkış yolunu birlikte veriyor.
    */
    if (cevap.okunamadi) {
      setAdim("okunamadi");
      return;
    }
    if (cevap.error || !cevap.form) {
      showToast("error", cevap.error ?? t({ tr: "Kılavuz okunamadı.", en: "The guideline could not be read." }));
      setAdim("secim");
      return;
    }
    setSonuc(cevap);
    setForm(cevap.form);
    setAdim("dogrulama");
  };

  const dosyaSec = async (dosya: File) => {
    if (dosya.type !== "application/pdf") {
      showToast("error", t({ tr: "Şimdilik yalnızca PDF okunabiliyor.", en: "Only PDFs can be read for now." }));
      return;
    }
    setAdim("tarama");
    try {
      setDurum(t({ tr: "Dosya yükleniyor…", en: "Uploading file…" }));
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        showToast("error", t({ tr: "Oturumunuz sona erdi. Yeniden giriş yapın.", en: "Your session has expired. Sign in again." }));
        setAdim("secim");
        return;
      }
      const yol = `${user.id}/kilavuz/${Date.now()}-${dosya.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("project-files").upload(yol, dosya, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (error) {
        console.error(error);
        showToast("error", t({ tr: "Dosya yüklenemedi. Yeniden deneyin.", en: "The file could not be uploaded. Try again." }));
        setAdim("secim");
        return;
      }
      /* Süre dürüstçe yazılıyor: taranmış PDF'te OCR yarım dakikayı bulabiliyor. */
      setDurum(
        t({
          tr: "Kılavuz okunuyor… Taranmış bir belgeyse yarım dakikayı bulabilir.",
          en: "Reading the guideline… If it is a scanned document, this can take up to half a minute.",
        }),
      );
      taramayiBitir(await kilavuzuTara(projectId, { depoYolu: yol }));
    } catch (err) {
      console.error(err);
      showToast("error", t({ tr: "Kılavuz okunamadı. Yeniden deneyin.", en: "The guideline could not be read. Try again." }));
      setAdim("secim");
    }
  };

  const adresTara = async () => {
    if (!adres.trim()) return;
    setAdim("tarama");
    setDurum(t({ tr: "Kılavuz indiriliyor ve okunuyor…", en: "Downloading and reading the guideline…" }));
    try {
      taramayiBitir(await kilavuzuTara(projectId, { adres }));
    } catch (err) {
      console.error(err);
      showToast("error", t({ tr: "Adres okunamadı. Yeniden deneyin.", en: "The address could not be read. Try again." }));
      setAdim("secim");
    }
  };

  const kaydet = async () => {
    if (!form) return;
    const hatalar = formuDogrula(form);
    if (hatalar.length > 0) {
      showToast("error", dogrulamaMesaji(hatalar[0], dil));
      /* Kutu pencerenin en üstünde; "Kurallarımı uygula" en altta.
         Eskiden yalnızca bildirim çıkıyordu ve öğrenci hangi kutunun
         boş olduğunu kaydırıp aramak zorundaydı (02.11.2026, DEÜ SBE). */
      if (hatalar[0] === "atif-stili-yok" || hatalar[0] === "atif-stili-taninmiyor") {
        setStilEksik(true);
        stilKutusu.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        stilKutusu.current?.focus({ preventScroll: true });
      }
      return;
    }
    setKaydediliyor(true);
    const cevap = await kilavuzuKaydet(projectId, {
      form,
      // Ad, kaynak ve kurallar sunucunun imzalı belirtecinden (lib/imzali-tarama.ts).
      belirtec: sonuc?.belirtec,
    });
    setKaydediliyor(false);
    if (cevap.error) {
      showToast("error", cevap.error);
      return;
    }
    showToast("success", t({ tr: "Kılavuzunuz çalışmaya uygulandı.", en: "Your guideline has been applied to the work." }));
    /* Pencerenin bulunduğu sayfa (Çalışmalarım kartı) yeni kuralları ve
       teslim listesini göstersin; eskiden pencere eski hâliyle kalıyordu. */
    router.refresh();
    onKapat?.();
  };

  if (adim === "okunamadi") {
    return (
      <div className="stack">
        <p className="alert" data-tone="warning" role="status">
          {t({
            tr: "Bu PDF'den metin çıkaramadık. Başka bir dosya seçebilir veya kılavuz eklemeden devam edebilirsiniz.",
            en: "We couldn't extract text from this PDF. You can choose another file or carry on without a guideline.",
          })}
        </p>
        <div className="cluster">
          <button type="button" className="projects-primary-button button-compact" onClick={() => setAdim("secim")}>
            {t({ tr: "Başka bir dosya seç", en: "Choose another file" })}
          </button>
          {/* Kılavuz isteğe bağlı: kaynak toplamak, atıf yapmak ve denetlemek kılavuzsuz da çalışıyor. */}
          <Link className="projects-filter-button button-compact" href={`/dashboard/literature?calisma=${projectId}`}>
            {t({ tr: "Kılavuz eklemeden devam et", en: "Continue without a guideline" })}
          </Link>
        </div>
      </div>
    );
  }

  if (adim === "tarama") {
    return (
      <div className="kilavuz-bekleme" role="status" aria-live="polite">
        <span className="kilavuz-bekleme-nokta" aria-hidden="true" />
        <strong>{durum}</strong>
        <p className="muted text-sm">{t({ tr: "Bu sırada sayfadan ayrılmayın.", en: "Don't leave the page in the meantime." })}</p>
      </div>
    );
  }

  const stilUyarisi = sonuc?.atifUyarisi ?? null;
  const digerUyarilar = sonuc?.uyarilar ?? [];

  if (adim === "dogrulama" && form) {
    return (
      <div className="stack">
        <p className="text-sm">
          {t({ tr: "Kılavuzunuzdan şunları okudum.", en: "This is what I read from your guideline." })}{" "}
          <b>{t({ tr: "Yanlış olanı düzeltin", en: "Correct anything that's wrong" })}</b>{" "}
          {t({
            tr: "— bu kurallar sonradan da değiştirilebilir ve resmî bir onay yerine geçmez.",
            en: "— these rules can be changed later and do not replace an official approval.",
          })}
        </p>

        {digerUyarilar.length ? (
          <p className="tone-text text-sm" data-tone="warning">
            {digerUyarilar[0]}
            {digerUyarilar.length > 1
              ? t({
                  tr: ` (+${digerUyarilar.length - 1} not)`,
                  en: ` (+${digerUyarilar.length - 1} note${digerUyarilar.length === 2 ? "" : "s"})`,
                })
              : ""}
          </p>
        ) : null}

        <label>
          <span>{t({ tr: "Kaynakça sistemi", en: "Citation system" })}</span>
          <StilSecici
            kutuRef={stilKutusu}
            className="field-control"
            value={form.atifStili}
            gecersiz={stilEksik && !form.atifStili}
            bosEtiket={t({ tr: "Seçin", en: "Select" })}
            onChange={(deger) => {
              setStilEksik(false);
              setForm({ ...form, atifStili: deger });
            }}
          />
          {/*
            Kılavuz sistem ADI vermiyorsa sunucu çalışmanın kendi sistemini
            (ya da yöntemin en yaygın sistemini) seçip nedenini yazıyor
            (otomatikAtifSistemi). Eskiden kutu boş geliyordu, gerekçe
            üstteki uyarı satırında "(+N not)" arkasında kalıyordu ve
            "Kurallarımı uygula" hata veriyordu (02.11.2026).
          */}
          {/*
            DAYANAK (23.11.2026): stilin kılavuzun HANGİ cümlesinden
            okunduğu. Eskiden yalnızca adı yazıyordu; öğrenci doğrulamak
            için kılavuzu açmak zorundaydı ve çoğu açmıyordu. Alıntı
            bulunamazsa hiçbir şey yazılmıyor — uydurma alıntı,
            alıntısızlıktan kötüdür.
          */}
          {sonuc?.stilDayanagi ? (
            <small className="kilavuz-dayanak">
              {sonuc.stilDayanagi.bolum || sonuc.stilDayanagi.sayfa
                ? t({
                    tr: `Kılavuzda ${[sonuc.stilDayanagi.bolum && `“${sonuc.stilDayanagi.bolum}” bölümünde`, sonuc.stilDayanagi.sayfa && `${sonuc.stilDayanagi.sayfa}. sayfada`].filter(Boolean).join(", ")}: `,
                    en: `In the guideline${[sonuc.stilDayanagi.bolum && `, section “${sonuc.stilDayanagi.bolum}”`, sonuc.stilDayanagi.sayfa && `, page ${sonuc.stilDayanagi.sayfa}`].filter(Boolean).join("")}: `,
                  })
                : t({ tr: "Kılavuzda: ", en: "In the guideline: " })}
              <q>{sonuc.stilDayanagi.alinti}</q>
            </small>
          ) : null}

          {/*
            ÇELİŞKİ: kılavuz BİRDEN ÇOK sistem söylüyor ve hangisinin
            geçerli olduğu PROGRAMA bağlı. Üç şey ayrı ayrı yazılıyor:
            çalışmanın şu anki stili, kılavuzun hangi program için neyi
            önerdiği ve her birinin kılavuzdaki cümlesi. Seçim yapılmadan
            kutudaki değer DEĞİŞMİYOR — "Kurallarımı uygula" o zaman
            çalışmanın kendi stilini yeniden yazar, yani stil değişmez.

            Eskiden burada "Kılavuz bir kaynakça sistemi belirtmiyor"
            yazıyor ve bir varsayılan seçili geliyordu: kılavuz açıkça iki
            sistem söylerken yanlış bir cümle ve öğrencinin hiç seçmediği
            bir stil.
          */}
          {sonuc?.stilAdaylari?.length ? (
            <div className="kilavuz-celiski">
              {sonuc.calismaStili ? (
                <p className="kilavuz-celiski-mevcut">
                  {t({
                    tr: `Çalışmanız şu anda ${t(stilAdiMetni(sonuc.calismaStili))} kullanıyor.`,
                    en: `Your work currently uses ${t(stilAdiMetni(sonuc.calismaStili))}.`,
                  })}
                </p>
              ) : null}
              <strong>
                {t({
                  tr: `Kılavuz ${sonuc.stilAdaylari.map((a) => `${a.dayanak?.kapsam ?? t({ tr: "bir bölüm", en: "one section" })} için ${a.etiket}`).join(", ")} öneriyor.`,
                  en: `The guideline recommends ${sonuc.stilAdaylari.map((a) => `${a.etiket} for ${a.dayanak?.kapsam ?? "one section"}`).join(", ")}.`,
                })}
              </strong>
              <p className="muted text-sm">
                {t({
                  tr: "Programınıza uygun stili seçebilir ya da mevcut stilinizle devam edebilirsiniz; seçmezseniz çalışmanızın stili değişmez.",
                  en: "You can pick the style that matches your programme or carry on with your current one; if you don't pick, your work's style stays as it is.",
                })}
              </p>
              <ul>
                {sonuc.stilAdaylari.map((aday) => (
                  <li key={aday.sistem}>
                    <button
                      type="button"
                      className={form.atifStili === aday.sistem ? "projects-primary-button button-compact" : "projects-filter-button button-compact"}
                      onClick={() => {
                        setStilEksik(false);
                        setForm({ ...form, atifStili: aday.sistem });
                      }}
                    >
                      {aday.dayanak?.kapsam
                        ? t({ tr: `${aday.dayanak.kapsam}: ${aday.etiket}`, en: `${aday.dayanak.kapsam}: ${aday.etiket}` })
                        : aday.etiket}
                    </button>
                    {aday.dayanak ? (
                      <small>
                        {aday.dayanak.bolum ? t({ tr: `“${aday.dayanak.bolum}” bölümü: `, en: `Section “${aday.dayanak.bolum}”: ` }) : ""}
                        <q>{aday.dayanak.alinti}</q>
                      </small>
                    ) : (
                      <small className="muted">
                        {t({ tr: `Kılavuzda ${aday.sayim} kez geçiyor; kuralı söyleyen cümlesini bulamadım.`, en: `Mentioned ${aday.sayim} times in the guideline; I couldn't find the sentence that states the rule.` })}
                      </small>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/*
            KILAVUZDA YAZAN İFADE ile SEÇİLİ SÜRÜM ayrı satırlarda.
            Kılavuz yalnızca "APA" diyorsa ürün bunu "APA 7" diye
            kesinleştiremez: 6. baskıyı kastediyor olabilir ve söylemediği
            bir şeyi söylemiş gibi göstermek öğrenciyi yanlış sürüme
            bağlar. Saklanan değer yine katalog kimliği — denetim bir
            kurallar kümesi olmadan çalışamaz — ama fark söyleniyor.
          */}
          {sonuc?.kilavuzIfadesi && form.atifStili && sonuc.kilavuzIfadesi !== t(stilAdiMetni(form.atifStili)) ? (
            <small className="kilavuz-ifade">
              {t({
                tr: `Kılavuzda yazan ifade: “${sonuc.kilavuzIfadesi}”. Seçili sürüm: ${t(stilAdiMetni(form.atifStili))}${sonuc.calismaStili ? ` (çalışmanızda kayıtlı: ${t(stilAdiMetni(sonuc.calismaStili))})` : ""}. Kılavuzunuz başka bir sürümü işaret ediyorsa yukarıdan değiştirin.`,
                en: `The guideline says “${sonuc.kilavuzIfadesi}”. Selected edition: ${t(stilAdiMetni(form.atifStili))}${sonuc.calismaStili ? ` (saved in your work: ${t(stilAdiMetni(sonuc.calismaStili))})` : ""}. If your guideline points to another edition, change it above.`,
              })}
            </small>
          ) : null}

          {/*
            İLK GÖNDERİMDE SERBEST BİÇİM: kılavuz bir stil adı geçirse de
            ilk gönderimde biçim serbestse, o adı zorunluymuş gibi
            göstermek yanlış alarmdır.
          */}
          {sonuc?.serbestBicim ? (
            <small className="kilavuz-serbest">
              {t({
                tr: "Kılavuzunuz ilk gönderimde serbest biçime izin veriyor; aşağıdaki stil zorunlu değil, denetim için kullanılır. Kabulden sonra istenen stile geçebilirsiniz.",
                en: "Your guideline allows a free format for the first submission; the style below isn't mandatory, it's used for checking. You can switch to the required style after acceptance.",
              })}
            </small>
          ) : null}

          {stilUyarisi ? (
            <small>{stilUyarisi}</small>
          ) : !sonuc?.form?.atifStili ? (
            <small className={stilEksik && !form.atifStili ? "tone-text" : undefined} data-tone={stilEksik && !form.atifStili ? "danger" : undefined}>
              {t({ tr: "Kılavuzda bulamadım; hangisi isteniyorsa seçin.", en: "I couldn't find it in the guideline; select the one required." })}
            </small>
          ) : null}
        </label>

        <div>
          <span className="kilavuz-alan-basligi">{t({ tr: "Zorunlu bölümler", en: "Required sections" })}</span>
          {/* Etiket listesi: on beş bölümü elle yeniden yazmak kimsenin işi değil. */}
          <div className="kilavuz-etiketler">
            {form.zorunluBolumler.map((bolum) => (
              <span className="chip" key={bolum}>
                {bolum}
                <button
                  type="button"
                  aria-label={t({ tr: `${bolum} bölümünü çıkar`, en: `Remove section ${bolum}` })}
                  onClick={() => setForm({ ...form, zorunluBolumler: form.zorunluBolumler.filter((b) => b !== bolum) })}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </span>
            ))}
            {form.zorunluBolumler.length === 0 ? (
              <span className="muted text-sm">{t({ tr: "Kılavuzda bulamadım; aşağıdan ekleyin.", en: "I couldn't find them in the guideline; add them below." })}</span>
            ) : null}
          </div>
          <div className="cluster mt-sm">
            <input
              className="field-control"
              value={yeniBolum}
              placeholder={t({ tr: "Bölüm ekle (örn. Bulgular)", en: "Add a section (e.g. Results)" })}
              onChange={(e) => setYeniBolum(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const ad = yeniBolum.trim();
                if (!ad || form.zorunluBolumler.includes(ad)) return;
                setForm({ ...form, zorunluBolumler: [...form.zorunluBolumler, ad] });
                setYeniBolum("");
              }}
            />
          </div>
        </div>

        <div className="kilavuz-sayfa">
          <label>
            <span>{t({ tr: "En az sayfa", en: "Minimum pages" })}</span>
            <input
              className="field-control"
              type="number"
              min={1}
              value={form.enAzSayfa ?? ""}
              onChange={(e) => setForm({ ...form, enAzSayfa: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
          <label>
            <span>{t({ tr: "En çok sayfa", en: "Maximum pages" })}</span>
            <input
              className="field-control"
              type="number"
              min={1}
              value={form.enCokSayfa ?? ""}
              onChange={(e) => setForm({ ...form, enCokSayfa: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
          {/* Boş bırakmak geçerli: her kılavuz sayfa sınırı söylemiyor. */}
          <p className="muted text-sm">
            {t({ tr: "Kılavuzunuz sayfa sınırı vermiyorsa ikisini de boş bırakın.", en: "If your guideline sets no page limit, leave both empty." })}
          </p>
        </div>

        {/*
          Onaylatılmayan ama uygulanacak biçim kuralları. Düzenlenmiyor,
          SÖYLENİYOR: on alanlık bir form okunmadan onaylanır, sessizce
          uygulamak da öğrenciye metninin neden başkalaştığını
          açıklamaz.
        */}
        <div className="kilavuz-bicim">
          <span className="kilavuz-alan-basligi">{t({ tr: "Ayrıca şu biçim kuralları uygulanacak", en: "These formatting rules will also be applied" })}</span>
          {/* Kuralları kim okudu: model (alıntılarıyla) ya da yalnızca kalıp (lib/ai/kilavuz-kurallari.ts).
              Ekranda "yapay zekâ" denmiyor (02.11.2026, kurum sahibinin kararı): öğrenciye
              söylenmesi gereken kaynak değil, kuralın kılavuzdaki cümlesiyle doğrulandığı. */}
          <p className="muted text-sm">
            {sonuc?.okuyan === "yapay-zeka"
              ? t({
                  tr: "Kurallar kılavuzunuzdan okundu; her biri kılavuzdaki cümlesiyle doğrulandı.",
                  en: "The rules were read from your guideline; each one was checked against its sentence in the guideline.",
                })
              : t({
                  tr: "Kurallar kılavuzunuzdan otomatik okundu; lütfen kılavuzla karşılaştırın.",
                  en: "The rules were read from your guideline automatically; please compare them with the guideline.",
                })}
          </p>
          {sonuc?.bicim?.length ? (
            <ul className="muted text-sm">
              {sonuc.bicim.map((satir) => (
                <li key={satir}>{satir}</li>
              ))}
            </ul>
          ) : (
            <p className="muted text-sm">
              {t({
                tr: "Kılavuzda biçim kuralı bulamadım; editörün varsayılanları kullanılacak.",
                en: "I found no formatting rules in the guideline; the editor's defaults will be used.",
              })}
            </p>
          )}
          {sonuc?.kanitlar?.length ? (
            <details className="kilavuz-kanitlar">
              <summary className="text-sm">
                {t({ tr: `Kılavuzunuzda nerede yazıyor (${sonuc.kanitlar.length})`, en: `Where your guideline says it (${sonuc.kanitlar.length})` })}
              </summary>
              <ul className="text-sm">
                {sonuc.kanitlar.map((k) => (
                  <li key={k.ad}>
                    <b>{k.ad}:</b> <q>{k.alinti}</q>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <div className="cluster">
          <button type="button" className="projects-primary-button" onClick={kaydet} disabled={kaydediliyor}>
            {kaydediliyor ? t({ tr: "Uygulanıyor…", en: "Applying…" }) : t({ tr: "Kurallarımı uygula", en: "Apply my rules" })}
          </button>
          <button type="button" className="projects-filter-button" onClick={() => setAdim("secim")}>
            {t({ tr: "Başka bir dosya seç", en: "Choose another file" })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="text-sm">
        {t({
          tr: "Kurumunuzun kılavuzu sistemde yok. Kendi kılavuzunuzu yüklerseniz biçim kuralları editöre kendiliğinden uygulanır; zorunlu bölümleri ve sayfa sınırını sizin yerinize takip ederim.",
          en: "Your institution's guideline is not in the system. If you upload your own, its formatting rules are applied to the editor automatically, and I keep track of the required sections and page limit for you.",
        })}
      </p>

      <label className="dropzone">
        <UploadCloud size={28} aria-hidden="true" />
        <span className="text-base">{t({ tr: "Kılavuz PDF'inizi seçin", en: "Choose your guideline PDF" })}</span>
        <small className="muted">
          {t({
            tr: "Danışmanınızın gönderdiği ya da enstitü sitesinden indirdiğiniz dosya.",
            en: "The file your advisor sent or that you downloaded from your graduate school's website.",
          })}
        </small>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            const dosya = e.target.files?.[0];
            if (dosya) void dosyaSec(dosya);
          }}
        />
      </label>

      <details className="form-details">
        <summary>{t({ tr: "Dosya yerine adres vereyim", en: "I'll give an address instead of a file" })}</summary>
        <div className="cluster mt-sm">
          <input
            className="field-control"
            value={adres}
            placeholder={t({ tr: "https://… kılavuzun bulunduğu sayfa ya da PDF", en: "https://… the page or PDF with the guideline" })}
            onChange={(e) => setAdres(e.target.value)}
          />
          <button type="button" className="projects-filter-button" onClick={adresTara} disabled={!adres.trim()}>
            <Link2 size={15} aria-hidden="true" />
            {t({ tr: "Adresten oku", en: "Read from address" })}
          </button>
        </div>
      </details>
    </div>
  );
}
