"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Link2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { kilavuzuKaydet, kilavuzuTara, type TaramaSonucu } from "@/app/actions/calisma-kilavuzu";
import { STIL_SECENEKLERI } from "@/lib/atif/stiller";
import { dogrulamaMesaji, formuDogrula, type DogrulamaFormu } from "@/lib/kilavuz-dogrulama";
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

type Adim = "secim" | "tarama" | "dogrulama";

export default function KilavuzYukle({ projectId, onKapat }: { projectId: string; onKapat?: () => void }) {
  const t = useCeviri();
  const dil = useDil();
  const [adim, setAdim] = useState<Adim>("secim");
  const [durum, setDurum] = useState("");
  const [adres, setAdres] = useState("");
  const [sonuc, setSonuc] = useState<TaramaSonucu | null>(null);
  const [form, setForm] = useState<DogrulamaFormu | null>(null);
  /*
    En son TARANAN kaynak; kayıt yalnızca bunu gönderir (29.10.2026).
    Eskiden adres kutusu ve dosya yolu ayrı tutuluyor, "Başka bir dosya
    seç" ile geri dönülünce sıfırlanmıyordu: adresi okutup sonra PDF
    yükleyen öğrencinin kuralları PDF'ten, "kılavuzu aç" bağlantısı
    ilgisiz adresten geliyordu.
  */
  const [taranan, setTaranan] = useState<{ depoYolu?: string; adres?: string } | null>(null);
  const [yeniBolum, setYeniBolum] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const router = useRouter();

  const taramayiBitir = (cevap: TaramaSonucu) => {
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
      setTaranan({ depoYolu: yol });
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
      setTaranan({ adres: adres.trim() });
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
      return;
    }
    setKaydediliyor(true);
    const cevap = await kilavuzuKaydet(projectId, {
      form,
      belgeBasligi: sonuc?.belgeBasligi ?? null,
      kaynakAdres: taranan?.adres ?? null,
      depoYolu: taranan?.depoYolu ?? null,
      hamCikarim: sonuc?.ham,
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

  if (adim === "tarama") {
    return (
      <div className="kilavuz-bekleme" role="status" aria-live="polite">
        <span className="kilavuz-bekleme-nokta" aria-hidden="true" />
        <strong>{durum}</strong>
        <p className="muted text-sm">{t({ tr: "Bu sırada sayfadan ayrılmayın.", en: "Don't leave the page in the meantime." })}</p>
      </div>
    );
  }

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

        {sonuc?.uyarilar?.length ? (
          <p className="tone-text text-sm" data-tone="warning">
            {sonuc.uyarilar[0]}
            {sonuc.uyarilar.length > 1
              ? t({
                  tr: ` (+${sonuc.uyarilar.length - 1} not)`,
                  en: ` (+${sonuc.uyarilar.length - 1} note${sonuc.uyarilar.length === 2 ? "" : "s"})`,
                })
              : ""}
          </p>
        ) : null}

        <label>
          <span>{t({ tr: "Kaynakça sistemi", en: "Citation system" })}</span>
          <select
            className="field-control"
            value={form.atifStili}
            onChange={(e) => setForm({ ...form, atifStili: e.target.value })}
          >
            <option value="">{t({ tr: "Seçin", en: "Select" })}</option>
            {STIL_SECENEKLERI.map((secenek) => (
              <option key={secenek.deger} value={secenek.deger}>
                {secenek.etiket}
              </option>
            ))}
          </select>
          {!sonuc?.form?.atifStili ? (
            <small>{t({ tr: "Kılavuzda bulamadım; hangisi isteniyorsa seçin.", en: "I couldn't find it in the guideline; select the one required." })}</small>
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
