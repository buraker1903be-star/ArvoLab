// RELEASE CLOSURE 06 — migration geçmişi manifestosu üreticisi.
// Girdi: siniflandirma.json (109 depo migration'ı; RAPOR.md §2'nin kaynağı) + aşağıdaki kurallar.
// Çıktı: MANIFESTO.md (insan için), manifesto.tsv (makine için), dalga-*.txt (sürüm listeleri).
// Production'a BAĞLANMAZ; yalnızca dosya üretir. Kullanım: node scripts/uzlastirma/gecmis/manifesto.mjs
import fs from "node:fs";

const KOK = new URL("./", import.meta.url).pathname;
const satirlar = JSON.parse(fs.readFileSync(`${KOK}siniflandirma.json`, "utf8"));

// Paketle uygulanacak migration'lar: geçmişe ANCAK paket uygulanıp Production özeti provanınkiyle eşleşince yazılır.
const PAKET = {
  "20261112195236": "P1", "20261115203504": "P2", "20260924100026": "P3", "20260924100027": "P3",
  "20260926131150": "P4", "20261106184046": "P5", "20261107113542": "P5", "20261107120542": "P5",
  "20260913120000": "P6",
};
// Tarihsel etkisi (veri adımı) ayrıca ölçülenler. "son koşul" = bugün Production'da sağlanması gereken durum.
const VERI = {
  "20260807113000": ["thesis_guidelines.university_id / academic_unit_id geri doldurma", "üniversitesi boş kılavuz 0; depo sürümünün dolduracağı birim 0 (17.11 ölçüldü)", "Production'daki eş kayıt (20260815134724) ikinci adımı İngilizce birim türüyle çalıştırdı ve hiçbir satır eşlemedi; bugün eşleşecek satır da yok"],
  "20260817120000": ["İstanbul Üniversitesi kök birimleri tohumu", "İstanbul Üniversitesi kök birimi 39 (17.11)", "Production'daki eş kayıt (20260817140252) birebir aynı içerikle çalıştı"],
  "20260914090000": ["staging tablosunda İngilizce birim türlerini Türkçeye çevirme + kısıt", "İngilizce değerli satır 0, Türkçe kısıt yerinde (17.11)", "tablo boş (0 satır); kısıt zaten Türkçe"],
  "20260915090000": ["onaylı kılavuz anlık görüntüsü + çalışmalara üniversite/birim/kılavuz atama", "onaylı ama anlık görüntüsü olmayan kılavuz 0; kılavuzu güncel fonksiyonla eşleşmeyen tez 0 (17.11)", "atamayı tetikleyiciler ve resync her değişiklikte yeniden yapıyor; tekrar çalıştırmak bir şey eklemez"],
  "20260923090000": ["bridge_health tohum satırı", "satır sayısı 1", "satır var"],
  "20260924100000": ["project-files kovasının boyut/MIME sınırı", "özel, 20 MB, 5 MIME türü (birebir)", "değer zaten aynı"],
  "20260924100007": ["kılavuzları dokunarak hazır-onay hesaplamasını tetikleme", "ready_for_approval NULL olan kılavuz 0", "tetikleyici her güncellemede yeniden hesaplıyor"],
  "20260924100010": ["OCR kılavuzlarının hazırlık durumunu yeniden hesaplatma", "ready_for_approval NULL 0", "aynı tetikleyici"],
  "20260924100034": ["tezlere kurum gözeten kılavuz eşlemesini yeniden uygulatma", "kılavuzu güncel best_guideline_for ile eşleşmeyen tez 0 (1 tezden)", "P4 fonksiyonu değiştirince sync tetikleyicisi yeni kayıtlarda yeni sürümü uygular; mevcut atamayı topluca değiştirmek ayrı karar"],
  "20260926135648": ["OCR ile tek tıkla hazır görünen kılavuzları geri çekme", "OCR kullanıp hazır görünen kılavuz 0", "koşulu sağlayan satır yok"],
  "20261025131500": ["onaylı anlık görüntülere sayı biçimi anahtarı ekleme", "9 onaylı anlık görüntünün 9'unda anahtar var", "koşulu sağlayan satır yok"],
  "20261027061010": ["mevcut tezlerde içindekiler kutusunu açma", "içindekiler kapalı tez 0", "koşulu sağlayan satır yok; yeniden çalıştırmak öğrencinin sonradan kapattığı kutuyu açar"],
  "20261027070012": ["ArvoOS üye adını boş profillere bir kez yazma", "adı boş ama listede adı olan profil 0", "koşulu sağlayan satır yok; tetikleyici sonrakileri karşılıyor"],
  "20261106184046": ["onaysız hesapların kurum bağını sökme (G1)", "uygulama PENCERESİNDE yeniden ölçülür (17.11: 0)", "P5'in parçası; 0 ölçümü kalıcı varsayım DEĞİL"],
};
// Kabul edilen sapmalar: son nesne Production'da farklı ama bilerek bırakılıyor; geçmişe yine de yazılır (yoksa CLI yeniden çalıştırmaya kalkar).
// KISMİ kayıtlar: sürüm "uygulandı" yazılır çünkü yeniden çalıştırmak güvenli değil (oturmuş tabloyu,
// dizinleri ve politikaları gözden geçirilmeden yeniden kurar); EKSİK PARÇA burada adıyla durur ve
// ileride YENİ bir migration'la (yeni sürüm) teslim edilir — kaydı geri çekerek değil.
const KISMI = {
  "20260806234000": { var: "tablo, RLS, SELECT politikası, yazma politikaları (sonraki migration'ların adlarıyla; politika grubu özeti eşit)", yok: "validate_academic_unit_parent() + tetikleyicisi, set_academic_unit_updated_at() + tetikleyicisi (P7, ertelendi); academic_units_university_parent_idx, academic_units_active_lookup_idx (Production'da yerine academic_units_root_unique); \"Authenticated users can view universities\" (Production'da yok, aynı koşulu \"All authenticated users can view universities\" sağlıyor)" },
  "20260806235500": { var: "academic_unit_import_staging tablosu (farklı yapıda), içe aktarma fonksiyonu (sonraki sürümle aynı)", yok: "staging tablosunun depodaki yapısı (Production'da farklı soy; çalışma anı kullanmıyor)" },
  "20260924100033": { var: "thesis_guidelines kurum sütunu/dizini ve öteki politikalar (özet eşit)", yok: "depodaki yinelenen universities SELECT politikası" },
};
// NET-EŞDEĞER: içeriği bir sonraki migration tarafından geri alınmış; ikisi birlikte uygulandığında net etki aynı.
const NET = { "20261107113542": "sifre_durumum() fonksiyonunu kurar; 20261107120542 onu kaldırır (P5 ikisini birlikte karşılar) — net etki yok" };
// Kendi içeriği eşit, fark başka bir migration'dan geliyor.
const DOLAYLI = { "20260924100003": "kendi nesneleri (guard_subscription, subscription_open, politikalar) özet eşit; individual_subscriptions farkı 20260924100027'nin deneme_hatirlatildi_at sütunundan (P3)" };
const KABUL = {
  "20260806234000": "academic_units tetikleyicileri (P7) bu yayında ertelendi. Uygulama etkisi: üst birim doğrulaması ve updated_at yalnızca çevrimdışı dizin betiğinde eksik; çalışma anı kullanmıyor. Yeni ortam: depodan kurulunca tetikleyiciler VAR (depo hedefi).",
  "20260806235500": "academic_unit_import_staging Production'da farklı soydan; yalnızca çevrimdışı scripts/academic-directory kullanıyor. Yeni ortam: depo yapısıyla kurulur; Production soyu (academic_programs, data_sources) depoya alınmadı.",
  "20260924100033": "Depoda fazladan yinelenen universities SELECT politikası; Production'da yok. Uygulama etkisi yok (aynı koşul). Yeni ortam: depodaki gibi kurulur.",
};

const satir = [];
for (const r of satirlar) {
  const paket = PAKET[r.v];
  const veri = VERI[r.v];
  const kabul = KABUL[r.v];
  let sonNesne, tarihsel, islem, dalga, onKosul, gerekce;
  if (r.durum === "EKSİK") {
    sonNesne = "hayır (Production'da yok/eski)";
    tarihsel = veri ? `veri adımı: ${veri[0]} — ${veri[1]}` : "şema-yalnız";
    islem = "repair --status applied";
    dalga = `B (${paket} sonrası)`;
    onKosul = `${paket} uygulandı ve Production özeti provanın ${paket} adımıyla eşleşti`;
    gerekce = r.v === "20261107113542" ? "içeriği (sifre_durumum) 20261107120542 kaldırıyor; P5 ikisini birlikte karşılıyor" : `içerik ${paket} ile birebir uygulanıyor`;
  } else if (paket) {
    sonNesne = "kısmen (tetikleyiciler eksik)";
    tarihsel = "şema-yalnız";
    islem = "repair --status applied";
    dalga = `B (${paket} sonrası)`;
    onKosul = `${paket} uygulandı; iki tetikleyici var`;
    gerekce = "fonksiyonlar Production'da aynı; eksik olan yalnızca P6'nın eklediği tetikleyiciler";
  } else if (kabul) {
    sonNesne = "hayır — kabul edilen sapma";
    tarihsel = "şema-yalnız";
    islem = "repair --status applied";
    dalga = "A";
    onKosul = "sapma kararı yazılı olarak kabul edildi";
    gerekce = kabul;
  } else {
    sonNesne = "evet (özet eşit)";
    tarihsel = veri ? `son koşul doğrulandı: ${veri[1]}` : "şema-yalnız: son hâl, etkinin tamamı";
    islem = "repair --status applied";
    dalga = "A";
    onKosul = "Dalga 0 tamam (entegrasyon + yedek)";
    gerekce = veri ? `veri işlemi yeniden çalıştırılmaz: ${veri[2]}` : "DDL idempotent; ara hâller kalıcı değil";
  }
  let kayit = "TAM";
  if (KISMI[r.v]) { kayit = `KISMİ — var: ${KISMI[r.v].var} · yok: ${KISMI[r.v].yok}`; }
  else if (NET[r.v]) { kayit = `NET-EŞDEĞER — ${NET[r.v]}`; }
  else if (DOLAYLI[r.v]) { kayit = "TAM (kendi içeriği)"; sonNesne = `evet (kendi nesneleri) — ${DOLAYLI[r.v]}`; }
  else if (r.durum === "EKSİK" || paket) { kayit = `TAM — ancak ${paket} uygulanıp doğrulandıktan sonra`; }
  satir.push({ surum: r.v, ad: r.ad, sinif: r.durum, sonNesne, tarihsel, kayit, islem, dalga, onKosul, gerekce });
}
// Production'daki 12 eski kayıt: DOKUNULMAZ; depoya boş yer tutucu eklenir.
const eski = fs.readdirSync(`${KOK}yer-tutucular`).sort().map((f) => {
  const ic = fs.readFileSync(`${KOK}yer-tutucular/${f}`, "utf8").match(/Production'daki içerik: (.*)/)[1];
  return { surum: f.slice(0, 14), ad: f.slice(15, -4), sinif: "ESKİ KAYIT", sonNesne: "—", tarihsel: ic, kayit: "Production'da zaten kayıtlı (dokunulmaz)", islem: "DOKUNMA (silme/reverted YOK)", dalga: "A0", onKosul: "boş yer tutucu dosya depoya alındı", gerekce: "CLI ve entegrasyon yerelde olmayan uzak sürümde durur; silmek geçmişi yok eder" };
});
const hepsi = [...eski, ...satir].sort((a, b) => a.surum.localeCompare(b.surum));

fs.writeFileSync(`${KOK}manifesto.tsv`, ["sürüm\tad\tsınıf\tson_nesne\ttarihsel_etki\tkayıt_durumu\tişlem\tdalga\tön_koşul\tgerekçe", ...hepsi.map((s) => [s.surum, s.ad, s.sinif, s.sonNesne, s.tarihsel, s.kayit, s.islem, s.dalga, s.onKosul, s.gerekce].join("\t"))].join("\n") + "\n");
const dalga = (d) => hepsi.filter((s) => s.dalga.startsWith(d) && s.islem.startsWith("repair")).map((s) => s.surum);
fs.writeFileSync(`${KOK}dalga-A.txt`, dalga("A").join("\n") + "\n");
for (const p of ["P1", "P2", "P3", "P4", "P5", "P6"]) fs.writeFileSync(`${KOK}dalga-B-${p}.txt`, hepsi.filter((s) => s.dalga === `B (${p} sonrası)`).map((s) => s.surum).join("\n") + "\n");

const say = (f) => hepsi.filter(f).length;
const md = [
  "# Migration geçmişi manifestosu (RELEASE CLOSURE 06)",
  "",
  "Üretildi: `node scripts/uzlastirma/gecmis/manifesto.mjs`. Production'a hiçbir şey uygulanmadı.",
  "Her satır tek bir geçmiş kaydıdır. **Son nesne** = bugünkü nesnenin Production'la özet eşitliği; **tarihsel etki** = migration'ın veri",
  "adımının ne yaptığı ve bugün gereken son koşulun sağlanıp sağlanmadığı. Şema-yalnız migration'da son hâl etkinin tamamıdır;",
  "veri adımı olanlarda son hâl tek başına kanıt değildir, son koşul ayrıca ölçüldü (17.11.2026, salt okunur).",
  "",
  `Toplam ${hepsi.length} kayıt: depo ${satir.length} + Production'daki eski ${eski.length}.`,
  `Dalga A (paketten bağımsız): ${dalga("A").length} · Dalga B (paket sonrası): ${say((s) => s.dalga.startsWith("B"))} · Dokunulmayan eski kayıt: ${eski.length}.`,
  "",
  "Kayıt durumu: **TAM** = içeriği Production'da (paketli olanlar paketten SONRA); **KISMİ** = kabul edilen sapma, eksik parça adıyla yazılı ve yeni bir migration'la teslim edilecek; **NET-EŞDEĞER** = sonraki migration içeriğini geri alıyor. CLI'ın \"bekleyen 0\" demesi şemanın depoyla aynı olduğu anlamına GELMEZ (RAPOR-RC06c §2).",
  "",
  "Kural: **hiçbir kayıt silinmez ya da `reverted` yapılmaz.** Eski 12 kayıt için depoya boş yer tutucu eklenir (`yer-tutucular/`).",
  "",
  "| Sürüm | Ad | Sınıf | Son nesne | Tarihsel etki | Kayıt durumu | İşlem | Dalga | Ön koşul | Gerekçe |",
  "|---|---|---|---|---|---|---|---|---|---|",
  ...hepsi.map((s) => `| \`${s.surum}\` | ${s.ad} | ${s.sinif} | ${s.sonNesne} | ${s.tarihsel} | ${s.kayit} | ${s.islem} | ${s.dalga} | ${s.onKosul} | ${s.gerekce} |`),
  "",
].join("\n");
fs.writeFileSync(`${KOK}MANIFESTO.md`, md);
console.log(`${hepsi.length} kayıt · A=${dalga("A").length} · B=${say((s) => s.dalga.startsWith("B"))} · eski=${eski.length}`);
