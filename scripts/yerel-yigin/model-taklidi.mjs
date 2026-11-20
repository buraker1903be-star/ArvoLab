// YEREL MODEL TAKLİDİ (Yazım Stüdyosu kabulü). OpenAI uyumlu /v1/chat/completions,
// yalnızca 127.0.0.1. Gerçek modelin YERİNE değil, asistan HATTININ (kapı, istem,
// doğrulama, kayıt, arayüz) yapay zekâ sağlayıcısı olmadan sınanabilmesi için:
// next dev'i AI_TABAN_URL=http://127.0.0.1:54900/v1 ile başlatın. Cevabın kalitesi
// bu taklitle ölçülmez; kabul raporu onu ayrıca UNVERIFIED yazar.
//
// Davranış (sorudaki işarete göre):
//   - yazım asistanı istemi → {yanit, metin}; metin Demir (2019)'a atıf yapar
//   - "UYDUR"    → kaynakta OLMAYAN bir alıntı döner (sunucu cevabı düşürmeli)
//   - diğerleri  → istemdeki seçili pasajı «…» ya da ilk sayfanın ilk cümlesini
//                  birebir alıntılar ve geldiği sayfayı yazar
// Gelen her istem STUDYO_ISTEM_KAYDI dosyasına (JSON satırı) eklenir: kabul betiği
// uydurma seçimin modele HİÇ ulaşmadığını ve seçili sayfaların gönderildiğini oradan okur.
import fs from "node:fs";
import http from "node:http";

const PORT = Number(process.env.MODEL_TAKLIDI_PORT ?? 54900);
const KAYIT = process.env.STUDYO_ISTEM_KAYDI ?? "/tmp/studyo-istem-kaydi.jsonl";

function cevapUret(mesajlar) {
  const hepsi = mesajlar.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
  /*
    Yazım asistanı (19.11.2026, Kayıtlı sekme kabulü): istem {"yanit","metin"}
    biçimini istiyor. Metin kütüphanedeki Demir (2019) kaynağına atıf yapar;
    sunucunun atıf ve sayı denetimi (yazimDenetle) gerçekten çalışır.
  */
  /*
    M4 kabulü (20.11.2026): kısaltma seçimin ilk yarısını döner (atıf ve
    olumsuzluk düşer → panel uyarısı görünmeli); isteğinde "ARAS" geçen
    serbest istek kütüphanede İKİ kaynağa uyan bir atıf yazar (belirsiz).
  */
  if (/Seçili metni kısalt:/.test(hepsi)) {
    const secim = hepsi.match(/SEÇİLİ METİN:\n([\s\S]*?)\n\n(?:[A-ZÇĞİÖŞÜ ]{4,}:)/)?.[1] ?? "";
    const sozcukler = secim.replace(/\([^)]*\)/g, "").split(/\s+/).filter(Boolean);
    return { yanit: "Kısalttım.", metin: `${sozcukler.slice(0, Math.max(3, Math.floor(sozcukler.length / 2))).join(" ").replace(/[,;]$/, "")}.` };
  }
  if (/YANIT BİÇİMİ: Yalnızca şu JSON nesnesini döndür/.test(hepsi) && /ARAS/.test(String(mesajlar.at(-1)?.content ?? ""))) {
    return { yanit: "Belirsiz atıflı bir cümle yazdım.", metin: "Bu görüş alanda tartışmalıdır (Aras, 2020)." };
  }
  if (/YANIT BİÇİMİ: Yalnızca şu JSON nesnesini döndür/.test(hepsi)) {
    return { yanit: "Akran gruplarıyla ilgili kısa bir paragraf yazdım.", metin: "Akran çalışma grupları birinci sınıf öğrencilerinde yalnızlığı azaltıyor (Demir, 2019)." };
  }
  const soru = String(mesajlar.at(-1)?.content ?? "");
  if (/UYDUR/.test(soru)) {
    return { bulundu: true, cevap: "Kaynak bunu açıkça söylüyor.", alintilar: [{ sayfa: 1, metin: "Remote learning eliminated isolation for every student in the sample." }] };
  }
  const secim = hepsi.match(/SEÇTİĞİ PASAJ \(SAYFA (\d+)[^)]*\):\n«([^»]+)»/);
  if (secim) {
    return { bulundu: true, cevap: "Pasaj, uzaktan öğrenmenin birinci sınıf öğrencilerinde bildirilen yalnızlığı artırdığını öne sürüyor.", alintilar: [{ sayfa: Number(secim[1]), metin: secim[2].trim() }] };
  }
  const sayfa = hepsi.match(/--- SAYFA (\d+) ---\n([^\n]+)/);
  return { bulundu: Boolean(sayfa), cevap: "Kaynağın başlığı aşağıda.", alintilar: sayfa ? [{ sayfa: Number(sayfa[1]), metin: sayfa[2].trim() }] : [] };
}

http
  .createServer((istek, yanit) => {
    let govde = "";
    istek.on("data", (p) => (govde += p));
    istek.on("end", () => {
      if (istek.method !== "POST" || !istek.url.endsWith("/chat/completions")) {
        yanit.writeHead(404).end();
        return;
      }
      const veri = JSON.parse(govde || "{}");
      fs.appendFileSync(KAYIT, `${JSON.stringify({ zaman: Date.now(), mesajlar: veri.messages })}\n`);
      const icerik = JSON.stringify(cevapUret(veri.messages ?? []));
      yanit.writeHead(200, { "Content-Type": "application/json" });
      yanit.end(
        JSON.stringify({
          id: "taklit",
          object: "chat.completion",
          model: veri.model ?? "taklit",
          choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: icerik } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      );
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`model taklidi: http://127.0.0.1:${PORT}/v1 · kayıt ${KAYIT}`));
