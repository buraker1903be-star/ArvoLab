"use client";

import { useState } from "react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import Dialog from "@/app/dashboard/_components/dialog";
import Secici from "@/app/dashboard/_components/secici";
import { Dugme, Durum, Girdi, MetinAlani, OnayKutusu, Secim, Sekmeler, SifreGirdisi } from "@/app/_components/ui";

/* Vitrin örnekleri: her bileşenin bütün durumları yan yana, sabit metinlerle. */
export default function VitrinOrnekleri() {
  const t = useCeviri();
  const [pencere, setPencere] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);

  return (
    <div className="os5-vitrin-govde">
      <section className="os5-vitrin-bolum" aria-labelledby="v-dugme">
        <h2 id="v-dugme" className="os5-vitrin-bolum-baslik">{t({ tr: "Düğmeler", en: "Buttons" })}</h2>
        <div className="os5-vitrin-satir">
          <Dugme>{t({ tr: "Birincil", en: "Primary" })}</Dugme>
          <Dugme tur="ikincil">{t({ tr: "İkincil", en: "Secondary" })}</Dugme>
          <Dugme tur="sessiz">{t({ tr: "Sessiz", en: "Quiet" })}</Dugme>
          <Dugme tur="tehlike">{t({ tr: "Sil", en: "Delete" })}</Dugme>
          <Dugme disabled>{t({ tr: "Pasif", en: "Disabled" })}</Dugme>
          <Dugme
            yukleniyor={yukleniyor}
            onClick={() => {
              setYukleniyor(true);
              window.setTimeout(() => setYukleniyor(false), 1500);
            }}
          >
            {t({ tr: "Kaydet", en: "Save" })}
          </Dugme>
        </div>
        <div className="os5-vitrin-satir">
          <Dugme boyut="sik">{t({ tr: "Sık birincil", en: "Compact primary" })}</Dugme>
          <Dugme boyut="sik" tur="ikincil">
            {t({ tr: "Sık ikincil", en: "Compact secondary" })}
          </Dugme>
        </div>
        <div className="os5-vitrin-form">
          <Dugme tamGenislik>{t({ tr: "Giriş yap (tam genişlik)", en: "Sign in (full width)" })}</Dugme>
        </div>
      </section>

      <section className="os5-vitrin-bolum" aria-labelledby="v-form">
        <h2 id="v-form" className="os5-vitrin-bolum-baslik">{t({ tr: "Form alanları", en: "Form fields" })}</h2>
        <div className="os5-vitrin-izgara">
          <Girdi etiket={t({ tr: "E-posta adresi", en: "Email address" })} type="email" placeholder="ad@ornek.edu.tr" autoComplete="off" required />
          <Girdi
            etiket={t({ tr: "E-posta adresi (hatalı)", en: "Email address (error)" })}
            type="email"
            defaultValue="ad@"
            hata={t({ tr: "Geçerli bir e-posta adresi yazın.", en: "Enter a valid email address." })}
            autoComplete="off"
          />
          <Girdi
            etiket={t({ tr: "Çalışma adı", en: "Work title" })}
            aciklama={t({ tr: "Danışmanınızın göreceği ad.", en: "The title your advisor will see." })}
            autoComplete="off"
          />
          <Girdi etiket={t({ tr: "Pasif alan", en: "Disabled field" })} defaultValue={t({ tr: "Değiştirilemez", en: "Read-only" })} disabled />
          <SifreGirdisi etiket={t({ tr: "Şifre", en: "Password" })} autoComplete="new-password" />
          <Secim etiket={t({ tr: "Atıf stili", en: "Citation style" })} defaultValue="apa">
            <option value="apa">APA 7</option>
            <option value="mla">MLA 9</option>
            <option value="chicago">Chicago</option>
          </Secim>
          <MetinAlani etiket={t({ tr: "Özet", en: "Abstract" })} maxLength={250} defaultValue="" />
          <div className="os5-vitrin-yigin">
            <OnayKutusu defaultChecked>{t({ tr: "Bildirimleri e-postayla al", en: "Receive notifications by email" })}</OnayKutusu>
            <OnayKutusu>{t({ tr: "Danışmanımla paylaş", en: "Share with my advisor" })}</OnayKutusu>
            <OnayKutusu disabled>{t({ tr: "Pasif seçenek", en: "Disabled option" })}</OnayKutusu>
          </div>
        </div>
      </section>

      <section className="os5-vitrin-bolum" aria-labelledby="v-sekme">
        <h2 id="v-sekme" className="os5-vitrin-bolum-baslik">{t({ tr: "Sekmeler", en: "Tabs" })}</h2>
        <Sekmeler
          etiket={t({ tr: "Ayarlar bölümleri", en: "Settings sections" })}
          sekmeler={[
            { kimlik: "profil", etiket: t({ tr: "Profil", en: "Profile" }), icerik: <p className="os5-vitrin-metin">{t({ tr: "Profil bölümünün içeriği.", en: "Profile section content." })}</p> },
            { kimlik: "gorunum", etiket: t({ tr: "Görünüm", en: "Appearance" }), icerik: <p className="os5-vitrin-metin">{t({ tr: "Tema ve dil tercihleri.", en: "Theme and language preferences." })}</p> },
            { kimlik: "guvenlik", etiket: t({ tr: "Güvenlik", en: "Security" }), icerik: <p className="os5-vitrin-metin">{t({ tr: "Şifre ve oturumlar.", en: "Password and sessions." })}</p> },
          ]}
        />
      </section>

      <section className="os5-vitrin-bolum" aria-labelledby="v-durum">
        <h2 id="v-durum" className="os5-vitrin-bolum-baslik">{t({ tr: "Durumlar", en: "States" })}</h2>
        <div className="os5-vitrin-izgara">
          <Durum
            tur="bos"
            baslik={t({ tr: "Henüz kaynak yok", en: "No sources yet" })}
            aciklama={t({ tr: "DOI ile ilk kaynağınızı ekleyin.", en: "Add your first source with a DOI." })}
            eylem={<Dugme boyut="sik">{t({ tr: "DOI ile ekle", en: "Add by DOI" })}</Dugme>}
          />
          <Durum tur="yukleniyor" baslik={t({ tr: "Yükleniyor", en: "Loading" })} />
          <Durum
            tur="hata"
            baslik={t({ tr: "Liste okunamadı", en: "Could not load the list" })}
            aciklama={t({ tr: "Bağlantınızı kontrol edip yeniden deneyin.", en: "Check your connection and try again." })}
            eylem={
              <Dugme boyut="sik" tur="ikincil">
                {t({ tr: "Yeniden dene", en: "Try again" })}
              </Dugme>
            }
          />
        </div>
      </section>

      <section className="os5-vitrin-bolum" aria-labelledby="v-katman">
        <h2 id="v-katman" className="os5-vitrin-bolum-baslik">{t({ tr: "Pencere ve açılır liste (os5 görünümü)", en: "Dialog and dropdown (os5 look)" })}</h2>
        <div className="os5-vitrin-satir">
          <Dugme tur="ikincil" onClick={() => setPencere(true)}>
            {t({ tr: "Pencereyi aç", en: "Open dialog" })}
          </Dugme>
          <Secici
            gorunum="os5"
            etiket={t({ tr: "Durum süzgeci", en: "Status filter" })}
            onEk={t({ tr: "Durum", en: "Status" })}
            deger="tum"
            gruplar={[
              {
                secenekler: [
                  { deger: "tum", etiket: t({ tr: "Tümü", en: "All" }) },
                  { deger: "taslak", etiket: t({ tr: "Taslak", en: "Draft" }) },
                  { deger: "teslim", etiket: t({ tr: "Teslim edildi", en: "Submitted" }) },
                ],
              },
            ]}
          />
        </div>
        <Dialog
          gorunum="os5"
          open={pencere}
          onClose={() => setPencere(false)}
          title={t({ tr: "Yeni çalışma", en: "New work" })}
          description={t({ tr: "Örnek pencere; hiçbir şey kaydedilmez.", en: "Sample dialog; nothing is saved." })}
        >
          <div className="os5-vitrin-yigin">
            <Girdi etiket={t({ tr: "Çalışma adı", en: "Work title" })} autoComplete="off" />
            <div className="os5-vitrin-satir">
              <Dugme onClick={() => setPencere(false)}>{t({ tr: "Tamam", en: "OK" })}</Dugme>
              <Dugme tur="ikincil" onClick={() => setPencere(false)}>
                {t({ tr: "Vazgeç", en: "Cancel" })}
              </Dugme>
            </div>
          </div>
        </Dialog>
      </section>

      <section className="os5-vitrin-bolum" aria-labelledby="v-yuzey">
        <h2 id="v-yuzey" className="os5-vitrin-bolum-baslik">{t({ tr: "Yüzey hiyerarşisi", en: "Surface hierarchy" })}</h2>
        <div className="os5-vitrin-izgara">
          <div className="os5-vitrin-yuzey os5-vitrin-yuzey--duz">{t({ tr: "Düzlem kart (kenarlıksız)", en: "Flat card (borderless)" })}</div>
          <div className="os5-vitrin-yuzey os5-vitrin-yuzey--kart">{t({ tr: "Kenarlıklı seçenek kartı", en: "Bordered option card" })}</div>
          <div className="os5-vitrin-yuzey os5-vitrin-yuzey--vurgu">
            <span className="os5-vitrin-vurgu-baslik">{t({ tr: "Akademik vurgu başlığı", en: "Academic accent heading" })}</span>
            <span>{t({ tr: "Koyu özet paneli", en: "Dark summary panel" })}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
