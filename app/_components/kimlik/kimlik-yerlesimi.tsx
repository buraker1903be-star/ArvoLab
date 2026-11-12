import type { ReactNode } from "react";
import ArvoLabLogosu from "@/app/_components/arvolab-logosu";
import ThemeToggle from "@/app/_components/theme-toggle";
import DilSecici from "@/app/_components/dil-secici";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { INGILIZCE_YAYINDA } from "@/lib/dil";
import { yasalAdres } from "@/lib/yasal-baglantilar";

/*
  KİMLİK YERLEŞİMİ (Signature OS 5, Phase 2, 12.11.2026). Giriş, kayıt,
  şifremi unuttum, yeni şifre ve bağlantı onayı aynı iskeleti kullanır.

  Eskiden giriş sayfası iki sütunlu bir tanıtım ekranıydı (özellik
  kartları, üç adım, ilkeler), kardeş sayfalar ise ortada tek bir kart;
  aynı akışın ekranları iki ayrı tasarım dilindeydi. Kurum sahibinin
  kararıyla (Paddle giriş ekranı yerleşim referansı): solda lacivert marka
  alanı, sağda tek sütun form. Pazarlama metni, kart ve süs yok; marka
  alanında yalnızca logo, tek başlık ve tek cümle.

  Sunum katmanıdır: formlar, eylemler ve hata eşlemeleri çağıran sayfada
  kalır. Buraya oturum, yönlendirme ya da Supabase çağrısı girmez.

  Telefonda marka alanı logoyu taşıyan ince bir şeride iner ve form ilk
  ekranda başlar. Yasal bağlantılar iki kez çizilir (marka alanının dibi ve
  formun altı); yalnızca biri görünür, gizli olan `display: none` olduğu
  için ekran okuyucu tek kez okur.

  DOM sırası: önce form, sonra marka alanı; marka alanı CSS'le (order)
  sola/üste alınır. Marka alanının tek etkileşimli öğesi yasal
  bağlantılar; DOM'da önde olsalar klavye kullanıcısı forma ulaşmadan
  önce onlardan geçerdi, ekran okuyucu da formdan önce tanıtım cümlesini
  okurdu.
*/
export default async function KimlikYerlesimi({ children }: { children: ReactNode }) {
  const t = await ceviri();
  const dil = await aktifDil();

  const yasal = (
    <>
      <span>© {new Date().getFullYear()} ArvoCulture Group</span>
      <a href={yasalAdres("gizlilik", dil)} target="_blank" rel="noreferrer">
        {t({ tr: "Gizlilik ve KVKK", en: "Privacy" })}
      </a>
      <a href="https://arvo-os.com" target="_blank" rel="noreferrer">
        arvo-os.com
      </a>
    </>
  );

  return (
    <div className="os5-kimlik">

      <div className="os5-kimlik-form">
        <div className="os5-kimlik-arac">
          {/* Çeviri bitene kadar gizli (lib/dil.ts, INGILIZCE_YAYINDA). */}
          {INGILIZCE_YAYINDA ? <DilSecici sinif="os5-kimlik-dil" /> : null}
          <ThemeToggle className="os5-kimlik-simge" />
        </div>
        <main className="os5-kimlik-icerik">
          <div className="os5-kimlik-kutu">
            {children}
          </div>
        </main>
        <footer className="os5-kimlik-yasal os5-kimlik-yasal--form">{yasal}</footer>
      </div>
      <aside className="os5-kimlik-marka" aria-label="ArvoLab">
        <ArvoLabLogosu className="os5-kimlik-logo" zemin="koyu" oncelikli />
        <div className="os5-kimlik-marka-govde">
          <p className="os5-kimlik-marka-baslik">
            {t({ tr: "Akademik yazımın çalışma masası.", en: "The workbench for academic writing." })}
          </p>
          <p className="os5-kimlik-marka-metin">
            {t({
              tr: "Kılavuz, kaynakça, analiz ve yazım tek bir çalışma alanında.",
              en: "Guidelines, references, analysis and writing in one workspace.",
            })}
          </p>
        </div>
        <footer className="os5-kimlik-yasal os5-kimlik-yasal--marka">{yasal}</footer>
      </aside>
    </div>
  );
}
