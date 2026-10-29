/*
  ARVOLAB KULLANIM SÖZLEŞMESİ (29.10.2026, kurum sahibinin isteği).

  Amaç: kullanıcının sözleşmeyi gerçekten gördüğünü, sonuna kadar
  okuduğunu ve onayladığını, sonradan bir itirazda delil olarak
  gösterebilmek. Onay ekranı (app/dashboard/_components/sozlesme-onayi.tsx)
  metni kaydırılabilir bir kutuda gösterir; düğme ancak sona gelince
  etkinleşir. Onay; sürüm, metnin SHA-256 özeti, zaman, IP ve cihaz
  bilgisiyle değiştirilemez bir kayda yazılır (sozlesme_onaylari,
  20261029160000) ve kopyası kullanıcıya e-postayla gider.

  SÜRÜM KURALI: Metinde tek bir harf değişirse SURUM da değişmeli. Özet
  metinden hesaplandığı için değişiklik kayıtta zaten görünür, ama sürüm
  değişmezse yeni metin onay istemeden yürürlüğe girmiş olur. Yeni sürüm
  yayımlanınca herkesten yeniden onay alınır.

  ŞİRKET KÜNYESİ ArvoOS'taki tek kaynaktan (ArvoOS lib/site/routes.ts
  COMPANY) birebir kopyalandı; iki depo arasında ortak kod yok. Orada
  değişirse burada da değişmeli ve SÜRÜM artırılmalı.

  Hukuki not: Metin, ArvoOS sitesindeki Mesafeli Satış Sözleşmesi ve
  İptal-İade Koşulları ile uyumlu yazıldı; yayımdan önce bir hukukçunun
  gözden geçirmesi gerekir.

  Saf modül: hem istemcide (gösterim) hem sunucuda (özet) kullanılır.
*/
import type { Dil } from "@/lib/dil";
import { yasalAdres } from "@/lib/yasal-baglantilar";

/* Aynı gün ikinci sürüm: 5. madde otomatik yenilemeyi anlatıyordu, otomatik
   çekim 29.10.2026'da kaldırıldı (ArvoOS otomatikYenilemeAcik). Sürüm
   değişince herkes metni yeniden onaylar; eski onay neye verildiyse onu kanıtlar. */
export const SOZLESME_SURUMU = "2026-10-29.2";

export type SozlesmeBolumu = { baslik: string; paragraflar: string[] };
export type SozlesmeMetni = { baslik: string; giris: string; bolumler: SozlesmeBolumu[] };

const KUNYE = {
  unvan: "ArvoCulture Group Teknoloji Sanayi ve Ticaret Limited Şirketi",
  adres: "Yakuplu Mah. Hürriyet Bulvarı Skyport Residence No:1 D:113, 34524 Beylikdüzü / İstanbul",
  adresIntl: "Yakuplu Mah., Hürriyet Bulvarı, Skyport Residence No:1 D:113, 34524 Beylikdüzü, Istanbul, Türkiye",
  eposta: "info@arvo-os.com",
  vergiDairesi: "Beylikdüzü",
  vergiNo: "0861785335",
  mersis: "0086178533500001",
};

function turkce(): SozlesmeMetni {
  return {
    baslik: "ArvoLab Kullanım Sözleşmesi",
    giris:
      `Sürüm: ${SOZLESME_SURUMU}. Bu sözleşme, ArvoLab akademik çalışma platformunun (lab.arvo-os.com) kullanımına ilişkin koşulları düzenler. `
      + "Lütfen sonuna kadar okuyunuz; onay düğmesi metnin sonuna ulaştığınızda etkinleşir.",
    bolumler: [
      {
        baslik: "1. Taraflar",
        paragraflar: [
          `Hizmet sağlayıcı: ${KUNYE.unvan} ("Şirket"). Adres: ${KUNYE.adres}. E-posta: ${KUNYE.eposta}. `
            + `Vergi dairesi / no: ${KUNYE.vergiDairesi} / ${KUNYE.vergiNo}. MERSİS: ${KUNYE.mersis}.`,
          "Kullanıcı: ArvoLab'da hesap açan, bireysel abone olan ya da bir kurumun lisansı kapsamında platformu kullanan gerçek kişi (\"Kullanıcı\").",
        ],
      },
      {
        baslik: "2. Tanımlar",
        paragraflar: [
          "Platform: ArvoLab yazılımı ve ona bağlı hizmetler. Hizmet: tez ve makale yazımı, kaynakça, veri analizi, belge denetimi, kanıt matrisi ve asistan özellikleri dâhil, Platform üzerinden sunulan her işlev. "
            + "İçerik: Kullanıcının Platform'a yüklediği ya da yazdığı metin, veri, dosya ve kaynaklar. Asistan: Platform'un yapay zekâ destekli denetim ve öneri işlevleri.",
        ],
      },
      {
        baslik: "3. Sözleşmenin konusu ve ekleri",
        paragraflar: [
          "Bu sözleşme, Kullanıcı'nın Platform'u kullanma koşullarını ve tarafların hak ve yükümlülüklerini düzenler.",
          `Mesafeli Satış Sözleşmesi (${yasalAdres("mesafeli-satis", "tr")}), İptal ve İade Koşulları (${yasalAdres("iptal-iade", "tr")}) ve Kişisel Verilerin Korunması Aydınlatma Metni (${yasalAdres("gizlilik", "tr")}) bu sözleşmenin ayrılmaz parçasıdır. Ücretli abonelik ve kredi satın alımlarında Mesafeli Satış Sözleşmesi hükümleri ayrıca uygulanır.`,
        ],
      },
      {
        baslik: "4. Hesap ve güvenlik",
        paragraflar: [
          "Kullanıcı, kayıtta verdiği bilgilerin doğru ve güncel olduğunu kabul eder. Hesap kişiseldir; giriş bilgileri başkasıyla paylaşılamaz.",
          "Kullanıcı, hesabı üzerinden yapılan işlemlerden sorumludur. Yetkisiz kullanım fark edildiğinde derhâl Şirket'e bildirilmelidir.",
        ],
      },
      {
        baslik: "5. Abonelik, ücret ve ödeme",
        paragraflar: [
          "Bireysel abonelik ve yapay zekâ kredi paketleri, ödeme anında gösterilen bedel üzerinden, Şirket'in anlaşmalı ödeme kuruluşu aracılığıyla tahsil edilir. Kart bilgileri Şirket tarafından saklanmaz.",
          "Karttan otomatik çekim yapılmaz. Her dönemin bedeli ayrı ayrı ödenir ve kartla ödeme, Kullanıcı'nın bankasının 3D Secure doğrulamasıyla (tek kullanımlık şifre) onaylanır. Abonelik, dönem bedeli ödenmedikçe kendiliğinden yenilenmez.",
          "Kurum lisansı kapsamındaki kullanıcıların ücreti, kurum ile Şirket arasındaki sözleşmeye tabidir.",
          "Ödemenin onaylanmasıyla hizmet derhâl kullanıma açılır. Kullanıcı, ödemeden sonra bu sözleşmeyi yeniden görüntüleyip onaylayarak hizmetin ifasının başladığını kabul eder.",
        ],
      },
      {
        baslik: "6. Cayma hakkı ve iade",
        paragraflar: [
          "Mesafeli Sözleşmeler Yönetmeliği m.15/1-(ğ) uyarınca, elektronik ortamda anında ifa edilen hizmetlerde, Kullanıcı'nın onayıyla ifaya başlanmışsa cayma hakkı kullanılamaz. Kullanıcı, ödemenin ardından hizmetin hemen kullanıma açılmasını talep ettiğini ve bu istisnanın uygulanacağını bildiğini kabul eder.",
          "Kullanılmamış yapay zekâ kredisi ve iade talepleri İptal ve İade Koşulları'na göre değerlendirilir.",
        ],
      },
      {
        baslik: "7. Akademik dürüstlük ve Kullanıcı'nın sorumluluğu",
        paragraflar: [
          "Platform, akademik çalışmayı Kullanıcı'nın yerine yazmaz. Asistan neyin eksik olduğunu ve neden önemli olduğunu söyler; çalışmanın metni, yöntemi, verisi ve sonuçları Kullanıcı'ya aittir ve Kullanıcı'nın sorumluluğundadır.",
          "Asistanın, analiz araçlarının, kaynakça ve kılavuz denetimlerinin çıktıları yardımcı niteliktedir; kesin doğruluk taahhüdü verilmez. Kullanıcı, kurumunun tez yazım kılavuzuna, etik kurallara ve intihal mevzuatına uymaktan kendisi sorumludur ve çıktıları kullanmadan önce doğrular.",
          "Platform, bir çalışmanın kabul edileceği, onaylanacağı ya da bir dergiye uygun olduğu yönünde hüküm vermez.",
        ],
      },
      {
        baslik: "8. İçerik ve fikri mülkiyet",
        paragraflar: [
          "Kullanıcı'nın İçeriği Kullanıcı'ya aittir. Kullanıcı, İçeriğin işlenmesi, saklanması, gösterilmesi ve dışa aktarılması için Şirket'e, yalnızca Hizmet'in sunulmasıyla sınırlı ve münhasır olmayan bir kullanım izni verir.",
          "Kullanıcı, yüklediği İçerik üzerinde gerekli haklara sahip olduğunu ve üçüncü kişilerin haklarını ihlal etmediğini kabul eder.",
          "Platform'un yazılımı, tasarımı, markası ve içeriği (Kullanıcı İçeriği hariç) Şirket'e aittir; izinsiz kopyalanamaz, çoğaltılamaz ve tersine mühendislik yapılamaz.",
        ],
      },
      {
        baslik: "9. Asistan kayıtları ve kişisel veriler",
        paragraflar: [
          "Her asistan çalışmasının girdisi, çıktısı ve Kullanıcı'nın değerlendirmesi kayıt altına alınır; bu kayıtlar hizmetin denetlenmesi, iyileştirilmesi ve Şirket'in kendi modellerinin geliştirilmesi amacıyla, Aydınlatma Metni'nde belirtilen esaslar çerçevesinde işlenebilir.",
          "Kişisel veriler 6698 sayılı Kişisel Verilerin Korunması Kanunu ve Aydınlatma Metni'ne uygun olarak işlenir.",
        ],
      },
      {
        baslik: "10. Yasaklı kullanımlar",
        paragraflar: [
          "Kullanıcı; Platform'u mevzuata aykırı amaçlarla, başkası adına sahte akademik çalışma üretmek ya da satmak için, sistemin güvenliğini ve işleyişini bozacak biçimde, otomatik araçlarla aşırı yük oluşturarak veya başkalarının verisine yetkisiz erişmek için kullanamaz.",
          "Bu yasaklara aykırılık hâlinde Şirket, hesabı askıya alma veya sözleşmeyi feshetme hakkına sahiptir.",
        ],
      },
      {
        baslik: "11. Hizmetin sürekliliği ve değişiklikler",
        paragraflar: [
          "Şirket, hizmeti makul özen ve teknik yeterlilikle sunar; kesintisiz ve hatasız çalışacağını taahhüt etmez. Planlı bakımlar mümkün olduğunca önceden duyurulur.",
          "Şirket, Platform'un özelliklerini geliştirmek amacıyla değiştirebilir.",
        ],
      },
      {
        baslik: "12. Sorumluluğun sınırı",
        paragraflar: [
          "Tüketici mevzuatından doğan haklar saklı kalmak kaydıyla, Şirket'in sorumluluğu ilgili Kullanıcı'nın son 12 (on iki) ayda ödediği bedelle sınırlıdır. Dolaylı zararlardan, kâr kaybından ve Kullanıcı'nın Platform çıktılarını doğrulamadan kullanmasından doğan zararlardan sorumluluk kabul edilmez.",
          "Kullanıcı, çalışmasının yedeğini almaktan kendisi sorumludur; Platform sürüm geçmişi ve dışa aktarma olanakları sunar.",
        ],
      },
      {
        baslik: "13. Süre, fesih ve hesabın silinmesi",
        paragraflar: [
          "Sözleşme, hesap açık kaldığı sürece yürürlüktedir. Kullanıcı hesabını Ayarlar'dan silebilir; silme talebinden sonra veriler 30 (otuz) günlük bekleme süresinin sonunda kalıcı olarak silinir, bu süre içinde giriş yapmak talebi geri alır.",
          "Mevzuatın saklanmasını zorunlu tuttuğu kayıtlar (ödeme ve fatura kayıtları ile bu sözleşmenin onay kaydı) yasal süre boyunca saklanır.",
        ],
      },
      {
        baslik: "14. Delil sözleşmesi ve elektronik onay kaydı",
        paragraflar: [
          "Kullanıcı, bu sözleşmeyi onayladığı anda aşağıdaki bilgilerin kayıt altına alındığını bilir ve kabul eder: onay tarihi ve saati, sözleşmenin sürümü ve metninin özeti (SHA-256), Kullanıcı'nın hesap ve e-posta bilgisi, IP adresi, cihaz ve tarayıcı bilgisi, metnin sonuna kadar görüntülendiği bilgisi ve onay, ödemeden sonra verildiyse ilgili ödemenin bilgisi. Onayın bir kopyası Kullanıcı'nın e-posta adresine gönderilir.",
          "Taraflar, 6100 sayılı Hukuk Muhakemeleri Kanunu m.193 uyarınca, Şirket'in sistemlerinde tutulan bu elektronik kayıtların, e-posta yazışmalarının ve işlem kayıtlarının uyuşmazlıklarda delil teşkil edeceğini kabul eder; karşı delil sunma hakkı saklıdır.",
        ],
      },
      {
        baslik: "15. Sözleşme değişiklikleri",
        paragraflar: [
          "Şirket bu sözleşmeyi güncelleyebilir. Yeni sürüm, Platform'a bir sonraki girişte Kullanıcı'ya gösterilir ve Kullanıcı onaylayana kadar Platform'un kullanımı bu onaya bağlanır. Onaylanmayan sürüm Kullanıcı bakımından yürürlüğe girmez; Kullanıcı bu durumda hesabını silebilir.",
        ],
      },
      {
        baslik: "16. Uyuşmazlıkların çözümü",
        paragraflar: [
          "Bu sözleşmeye Türkiye Cumhuriyeti hukuku uygulanır. Tüketici sıfatını taşıyan Kullanıcı'lar bakımından, Ticaret Bakanlığı'nca ilan edilen parasal sınırlar çerçevesinde Kullanıcı'nın veya Şirket'in yerleşim yerindeki Tüketici Hakem Heyetleri ile Tüketici Mahkemeleri yetkilidir. Diğer hâllerde İstanbul mahkemeleri ve icra daireleri yetkilidir.",
        ],
      },
      {
        baslik: "17. Yürürlük",
        paragraflar: [
          "Kullanıcı, bu metni sonuna kadar okuduğunu, anladığını ve \"Okudum ve onaylıyorum\" düğmesine basarak elektronik ortamda kabul ettiğini beyan eder. Sözleşme, onay anında yürürlüğe girer.",
        ],
      },
    ],
  };
}

function ingilizce(): SozlesmeMetni {
  return {
    baslik: "ArvoLab Terms of Use",
    giris:
      `Version: ${SOZLESME_SURUMU}. These terms govern the use of the ArvoLab academic work platform (lab.arvo-os.com). `
      + "Please read them to the end; the approval button becomes active once you reach the end of the text.",
    bolumler: [
      {
        baslik: "1. Parties",
        paragraflar: [
          `Service provider: ${KUNYE.unvan} (the "Company"). Address: ${KUNYE.adresIntl}. Email: ${KUNYE.eposta}. `
            + `Tax office / number: ${KUNYE.vergiDairesi} / ${KUNYE.vergiNo}. MERSIS: ${KUNYE.mersis}.`,
          "User: the natural person who opens an ArvoLab account, subscribes individually or uses the platform under an institution's licence (the \"User\").",
        ],
      },
      {
        baslik: "2. Definitions",
        paragraflar: [
          "Platform: the ArvoLab software and related services. Service: every function offered through the Platform, including thesis and article writing, references, data analysis, document checks, the evidence matrix and assistant features. "
            + "Content: text, data, files and sources the User uploads to or writes on the Platform. Assistant: the Platform's AI-assisted review and suggestion functions.",
        ],
      },
      {
        baslik: "3. Subject and annexes",
        paragraflar: [
          "These terms govern the conditions under which the User may use the Platform and the rights and obligations of the parties.",
          `The Distance Sales Agreement (${yasalAdres("mesafeli-satis", "en")}), the Cancellation and Refund Policy (${yasalAdres("iptal-iade", "en")}) and the Privacy Notice (${yasalAdres("gizlilik", "en")}) form an integral part of these terms. For paid subscriptions and credit purchases, the Distance Sales Agreement also applies.`,
        ],
      },
      {
        baslik: "4. Account and security",
        paragraflar: [
          "The User confirms that the information given at registration is accurate and up to date. The account is personal; login details may not be shared.",
          "The User is responsible for actions taken through the account and must notify the Company immediately of any unauthorised use.",
        ],
      },
      {
        baslik: "5. Subscription, fees and payment",
        paragraflar: [
          "Individual subscriptions and AI credit packages are charged at the price shown at the time of payment, through the Company's contracted payment institution. The Company does not store card details.",
          "No automatic card charges are made. Each period is paid separately, and card payments are authorised by the User's bank through 3D Secure (one-time passcode). The subscription does not renew by itself unless the period fee is paid.",
          "Fees for users covered by an institution's licence are governed by the agreement between the institution and the Company.",
          "The service becomes available immediately once payment is approved. By reviewing and approving these terms again after payment, the User acknowledges that performance of the service has begun.",
        ],
      },
      {
        baslik: "6. Right of withdrawal and refunds",
        paragraflar: [
          "Under Article 15(1)(ğ) of the Turkish Distance Contracts Regulation, the right of withdrawal cannot be exercised for services performed instantly in electronic form once performance has started with the User's consent. The User acknowledges having requested immediate access to the service after payment and that this exception applies.",
          "Unused AI credits and refund requests are handled under the Cancellation and Refund Policy.",
        ],
      },
      {
        baslik: "7. Academic integrity and the User's responsibility",
        paragraflar: [
          "The Platform does not write academic work on the User's behalf. The Assistant points out what is missing and why it matters; the text, method, data and results of the work belong to, and are the responsibility of, the User.",
          "Outputs of the Assistant, analysis tools, reference and guideline checks are supportive and carry no guarantee of correctness. The User is responsible for complying with their institution's writing guideline, ethical rules and plagiarism regulations, and verifies outputs before using them.",
          "The Platform does not rule on whether a work will be accepted, approved or is suitable for a journal.",
        ],
      },
      {
        baslik: "8. Content and intellectual property",
        paragraflar: [
          "The User's Content belongs to the User. The User grants the Company a non-exclusive permission, limited to providing the Service, to process, store, display and export the Content.",
          "The User confirms holding the necessary rights to uploaded Content and that it does not infringe third-party rights.",
          "The Platform's software, design, brand and content (excluding User Content) belong to the Company and may not be copied, reproduced or reverse-engineered without permission.",
        ],
      },
      {
        baslik: "9. Assistant records and personal data",
        paragraflar: [
          "The input, output and the User's rating of each assistant run are recorded; these records may be processed to monitor and improve the service and to develop the Company's own models, under the principles set out in the Privacy Notice.",
          "Personal data is processed in accordance with Turkish Law No. 6698 on the Protection of Personal Data and the Privacy Notice.",
        ],
      },
      {
        baslik: "10. Prohibited use",
        paragraflar: [
          "The User may not use the Platform for unlawful purposes, to produce or sell fraudulent academic work for others, in a way that compromises its security or operation, to overload it with automated tools, or to access others' data without authorisation.",
          "If these prohibitions are breached, the Company may suspend the account or terminate the agreement.",
        ],
      },
      {
        baslik: "11. Service continuity and changes",
        paragraflar: [
          "The Company provides the service with reasonable care and technical competence but does not guarantee uninterrupted or error-free operation. Planned maintenance is announced in advance where possible.",
          "The Company may change Platform features in order to improve it.",
        ],
      },
      {
        baslik: "12. Limitation of liability",
        paragraflar: [
          "Without prejudice to rights under consumer law, the Company's liability is limited to the amount paid by the User in the last 12 (twelve) months. No liability is accepted for indirect damage, loss of profit, or damage arising from the User relying on Platform outputs without verifying them.",
          "The User is responsible for keeping backups of their work; the Platform offers version history and export options.",
        ],
      },
      {
        baslik: "13. Term, termination and account deletion",
        paragraflar: [
          "These terms remain in force while the account is open. The User may delete the account from Settings; after a deletion request, data is permanently deleted at the end of a 30 (thirty) day waiting period, and signing in during that period withdraws the request.",
          "Records that the law requires to be kept (payment and invoice records and the approval record of these terms) are retained for the statutory period.",
        ],
      },
      {
        baslik: "14. Evidence agreement and electronic approval record",
        paragraflar: [
          "The User knows and accepts that, at the moment of approving these terms, the following is recorded: the date and time of approval, the version of the terms and a digest of their text (SHA-256), the User's account and email, IP address, device and browser information, the fact that the text was viewed to the end, and, if the approval follows a payment, information about that payment. A copy of the approval is sent to the User's email address.",
          "Under Article 193 of the Turkish Code of Civil Procedure No. 6100, the parties agree that these electronic records, email correspondence and transaction logs kept in the Company's systems constitute evidence in disputes; the right to submit counter-evidence is reserved.",
        ],
      },
      {
        baslik: "15. Changes to these terms",
        paragraflar: [
          "The Company may update these terms. A new version is shown to the User at the next sign-in and use of the Platform depends on approving it. A version that is not approved does not take effect for the User; the User may then delete the account.",
        ],
      },
      {
        baslik: "16. Governing law and disputes",
        paragraflar: [
          "These terms are governed by the laws of the Republic of Türkiye. For Users who are consumers, Consumer Arbitration Committees and Consumer Courts at the User's or the Company's place of residence are competent within the monetary limits announced by the Ministry of Trade. Otherwise, the courts and enforcement offices of Istanbul are competent.",
        ],
      },
      {
        baslik: "17. Entry into force",
        paragraflar: [
          "The User declares having read these terms to the end, understood them, and accepted them electronically by pressing the \"I have read and agree\" button. The terms take effect at the moment of approval.",
        ],
      },
    ],
  };
}

export function kullanimSozlesmesi(dil: Dil): SozlesmeMetni {
  return dil === "en" ? ingilizce() : turkce();
}

/**
 * Özeti alınan, kayda geçen düz metin. Gösterilen metinle BİREBİR aynı
 * içerik: başlık, giriş ve her bölüm; satır sonlarıyla birleşik.
 */
export function sozlesmeDuzMetni(dil: Dil): string {
  const m = kullanimSozlesmesi(dil);
  return [m.baslik, m.giris, ...m.bolumler.flatMap((b) => [b.baslik, ...b.paragraflar])].join("\n");
}
