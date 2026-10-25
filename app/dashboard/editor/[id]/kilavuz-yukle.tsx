"use client";

import { useState } from "react";
import { UploadCloud, Link2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { kilavuzuKaydet, kilavuzuTara, type TaramaSonucu } from "@/app/actions/calisma-kilavuzu";
import { STIL_SECENEKLERI } from "@/lib/atif/stiller";
import { DOGRULAMA_MESAJI, formuDogrula, type DogrulamaFormu } from "@/lib/kilavuz-dogrulama";

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
  const [adim, setAdim] = useState<Adim>("secim");
  const [durum, setDurum] = useState("");
  const [adres, setAdres] = useState("");
  const [sonuc, setSonuc] = useState<TaramaSonucu | null>(null);
  const [form, setForm] = useState<DogrulamaFormu | null>(null);
  const [depoYolu, setDepoYolu] = useState<string | null>(null);
  const [yeniBolum, setYeniBolum] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const taramayiBitir = (cevap: TaramaSonucu) => {
    if (cevap.error || !cevap.form) {
      showToast("error", cevap.error ?? "Kılavuz okunamadı.");
      setAdim("secim");
      return;
    }
    setSonuc(cevap);
    setForm(cevap.form);
    setAdim("dogrulama");
  };

  const dosyaSec = async (dosya: File) => {
    if (dosya.type !== "application/pdf") {
      showToast("error", "Şimdilik yalnızca PDF okunabiliyor.");
      return;
    }
    setAdim("tarama");
    try {
      setDurum("Dosya yükleniyor…");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        showToast("error", "Oturumunuz sona erdi. Yeniden giriş yapın.");
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
        showToast("error", "Dosya yüklenemedi. Yeniden deneyin.");
        setAdim("secim");
        return;
      }
      setDepoYolu(yol);
      /* Süre dürüstçe yazılıyor: taranmış PDF'te OCR yarım dakikayı bulabiliyor. */
      setDurum("Kılavuz okunuyor… Taranmış bir belgeyse yarım dakikayı bulabilir.");
      taramayiBitir(await kilavuzuTara(projectId, { depoYolu: yol }));
    } catch (err) {
      console.error(err);
      showToast("error", "Kılavuz okunamadı. Yeniden deneyin.");
      setAdim("secim");
    }
  };

  const adresTara = async () => {
    if (!adres.trim()) return;
    setAdim("tarama");
    setDurum("Kılavuz indiriliyor ve okunuyor…");
    try {
      taramayiBitir(await kilavuzuTara(projectId, { adres }));
    } catch (err) {
      console.error(err);
      showToast("error", "Adres okunamadı. Yeniden deneyin.");
      setAdim("secim");
    }
  };

  const kaydet = async () => {
    if (!form) return;
    const hatalar = formuDogrula(form);
    if (hatalar.length > 0) {
      showToast("error", DOGRULAMA_MESAJI[hatalar[0]]);
      return;
    }
    setKaydediliyor(true);
    const cevap = await kilavuzuKaydet(projectId, {
      form,
      belgeBasligi: sonuc?.belgeBasligi ?? null,
      kaynakAdres: adres.trim() || null,
      depoYolu,
      hamCikarim: sonuc?.ham,
    });
    setKaydediliyor(false);
    if (cevap.error) {
      showToast("error", cevap.error);
      return;
    }
    showToast("success", "Kılavuzunuz çalışmaya uygulandı.");
    onKapat?.();
  };

  if (adim === "tarama") {
    return (
      <div className="kilavuz-bekleme" role="status" aria-live="polite">
        <span className="kilavuz-bekleme-nokta" aria-hidden="true" />
        <strong>{durum}</strong>
        <p className="muted text-sm">Bu sırada sayfadan ayrılmayın.</p>
      </div>
    );
  }

  if (adim === "dogrulama" && form) {
    return (
      <div className="stack">
        <p className="text-sm">
          Kılavuzunuzdan şunları okudum. <b>Yanlış olanı düzeltin</b> — bu kurallar sonradan da
          değiştirilebilir ve resmî bir onay yerine geçmez.
        </p>

        {sonuc?.uyarilar?.length ? (
          <p className="tone-text text-sm" data-tone="warning">
            {sonuc.uyarilar[0]}
            {sonuc.uyarilar.length > 1 ? ` (+${sonuc.uyarilar.length - 1} not)` : ""}
          </p>
        ) : null}

        <label>
          <span>Kaynakça sistemi</span>
          <select
            className="field-control"
            value={form.atifStili}
            onChange={(e) => setForm({ ...form, atifStili: e.target.value })}
          >
            <option value="">Seçin</option>
            {STIL_SECENEKLERI.map((secenek) => (
              <option key={secenek.deger} value={secenek.deger}>
                {secenek.etiket}
              </option>
            ))}
          </select>
          {!sonuc?.form?.atifStili ? (
            <small>Kılavuzda bulamadım; hangisi isteniyorsa seçin.</small>
          ) : null}
        </label>

        <div>
          <span className="kilavuz-alan-basligi">Zorunlu bölümler</span>
          {/* Etiket listesi: on beş bölümü elle yeniden yazmak kimsenin işi değil. */}
          <div className="kilavuz-etiketler">
            {form.zorunluBolumler.map((bolum) => (
              <span className="chip" key={bolum}>
                {bolum}
                <button
                  type="button"
                  aria-label={`${bolum} bölümünü çıkar`}
                  onClick={() => setForm({ ...form, zorunluBolumler: form.zorunluBolumler.filter((b) => b !== bolum) })}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </span>
            ))}
            {form.zorunluBolumler.length === 0 ? (
              <span className="muted text-sm">Kılavuzda bulamadım; aşağıdan ekleyin.</span>
            ) : null}
          </div>
          <div className="cluster mt-sm">
            <input
              className="field-control"
              value={yeniBolum}
              placeholder="Bölüm ekle (örn. Bulgular)"
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
            <span>En az sayfa</span>
            <input
              className="field-control"
              type="number"
              min={1}
              value={form.enAzSayfa ?? ""}
              onChange={(e) => setForm({ ...form, enAzSayfa: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
          <label>
            <span>En çok sayfa</span>
            <input
              className="field-control"
              type="number"
              min={1}
              value={form.enCokSayfa ?? ""}
              onChange={(e) => setForm({ ...form, enCokSayfa: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
          {/* Boş bırakmak geçerli: her kılavuz sayfa sınırı söylemiyor. */}
          <p className="muted text-sm">Kılavuzunuz sayfa sınırı vermiyorsa ikisini de boş bırakın.</p>
        </div>

        <div className="cluster">
          <button type="button" className="projects-primary-button" onClick={kaydet} disabled={kaydediliyor}>
            {kaydediliyor ? "Uygulanıyor…" : "Kurallarımı uygula"}
          </button>
          <button type="button" className="projects-filter-button" onClick={() => setAdim("secim")}>
            Başka bir dosya seç
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="text-sm">
        Kurumunuzun kılavuzu sistemde yok. Kendi kılavuzunuzu yüklerseniz biçim kuralları editöre
        kendiliğinden uygulanır; zorunlu bölümleri ve sayfa sınırını sizin yerinize takip ederim.
      </p>

      <label className="dropzone">
        <UploadCloud size={28} aria-hidden="true" />
        <span className="text-base">Kılavuz PDF&apos;inizi seçin</span>
        <small className="muted">Danışmanınızın gönderdiği ya da enstitü sitesinden indirdiğiniz dosya.</small>
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
        <summary>Dosya yerine adres vereyim</summary>
        <div className="cluster mt-sm">
          <input
            className="field-control"
            value={adres}
            placeholder="https://… kılavuzun bulunduğu sayfa ya da PDF"
            onChange={(e) => setAdres(e.target.value)}
          />
          <button type="button" className="projects-filter-button" onClick={adresTara} disabled={!adres.trim()}>
            <Link2 size={15} aria-hidden="true" />
            Adresten oku
          </button>
        </div>
      </details>
    </div>
  );
}
