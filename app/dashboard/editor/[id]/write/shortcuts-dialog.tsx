"use client";

import Dialog from "@/app/dashboard/_components/dialog";

/*
  Editörün klavye kısayolları, işe göre gruplu (27.10.2026). Word'le aynı
  tuşlar (lib/tiptap-klavye.ts) ve Tiptap'ın kendi kısayolları. Liste uzadı;
  gruplar olmadan öğrenci aradığını bulamıyordu. Kullanım kılavuzu da bu
  listeden yazılabilir — iki ayrı liste tutulursa biri eskir.
*/
type Kisayol = [string[], string];
const GRUPLAR: { baslik: string; satirlar: Kisayol[] }[] = [
  {
    baslik: "Belge",
    satirlar: [
      [["Mod", "S"], "Şimdi kaydet (zaten otomatik kaydedilir)"],
      [["Mod", "P"], "Yazdır / PDF (kılavuz düzeninde, sayfalı)"],
      [["Mod", "F"], "Bul ve değiştir"],
      [["Mod", "Z"], "Geri al"],
      [["Mod", "Y"], "Yinele (Mod+Shift+Z de olur)"],
    ],
  },
  {
    baslik: "Yazı biçimi",
    satirlar: [
      [["Mod", "B"], "Kalın"],
      [["Mod", "I"], "İtalik"],
      [["Mod", "U"], "Altı çizili"],
      [["Mod", "Shift", "="], "Üst simge (Mod+. de olur)"],
      [["Mod", ">"], "Yazıyı bir punto büyüt (Türkçe klavyede Mod+Shift+<; Mod+] de olur)"],
      [["Mod", "<"], "Yazıyı bir punto küçült (Mod+[ de olur)"],
      [["Mod", "Boşluk"], "Karakter biçimini temizle"],
      [["Shift", "F3"], "Seçili metin: küçük harf → BÜYÜK HARF → Başlık Düzeni"],
    ],
  },
  {
    baslik: "Paragraf",
    satirlar: [
      [["Mod", "L"], "Sola hizala"],
      [["Mod", "E"], "Ortala"],
      [["Mod", "R"], "Sağa hizala"],
      [["Mod", "J"], "İki yana yasla"],
      [["Tab"], "Paragraf başında ilk satır girintisi; metin içinde sekme"],
      [["Shift", "Tab"], "Paragraf başında girintiyi kaldır"],
      [["Backspace"], "Girintili paragrafın başında: önce girintiyi kaldır"],
      [["Shift", "Enter"], "Aynı paragrafta alt satıra geç"],
    ],
  },
  {
    baslik: "Başlık, liste, alıntı",
    satirlar: [
      [["Mod", "Alt", "1"], "Başlık 1 (2 ve 3 için aynı)"],
      [["Mod", "Alt", "0"], "Normal metne dön"],
      [["Mod", "Shift", "8"], "Madde işaretli liste"],
      [["Mod", "Shift", "7"], "Numaralı liste"],
      [["Mod", "Shift", "B"], "Alıntı"],
      [["Tab"], "Listede: maddeyi içeri al (Shift+Tab: dışarı)"],
      [["#", "Boşluk"], "Satır başında: Başlık 1 (## ve ### ile Başlık 2 ve 3)"],
      [["-", "Boşluk"], "Satır başında: madde işaretli liste"],
      [["1.", "Boşluk"], "Satır başında: numaralı liste"],
      [[">", "Boşluk"], "Satır başında: alıntı"],
    ],
  },
  {
    baslik: "Tablo ve dipnot",
    satirlar: [
      // Tablo kısayolları hiçbir yerde yazmıyordu; kullanıcı son hücrede Tab'a
      // basınca satır açıldığını tesadüfen öğreniyordu.
      [["Tab"], "Tabloda sonraki hücre (son hücrede: yeni satır)"],
      [["Shift", "Tab"], "Tabloda önceki hücre"],
      [["Mod", "Alt", "F"], "Dipnot ekle"],
      [["Mod", "Enter"], "Dipnot penceresinde kaydet"],
    ],
  },
  {
    baslik: "Pencereler",
    satirlar: [
      [["Enter"], "Bul kutusunda sonraki eşleşme (Shift+Enter: önceki)"],
      [["Esc"], "Açık pencereyi ya da bul çubuğunu kapat"],
    ],
  },
];

export default function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent);
  const label = (key: string) => {
    if (key === "Mod") return isMac ? "⌘" : "Ctrl";
    if (key === "Alt") return isMac ? "⌥" : "Alt";
    if (key === "Shift") return isMac ? "⇧" : "Shift";
    return key;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      kicker="Yardım"
      title="Klavye kısayolları"
      description="Word'deki tuşlar burada da aynı işi yapar. Fareye uzanmadan daha hızlı yazın."
    >
      {GRUPLAR.map((grup) => (
        <section key={grup.baslik} className="shortcut-grup" aria-label={grup.baslik}>
          <h3>{grup.baslik}</h3>
          <dl className="shortcut-list">
            {grup.satirlar.map(([keys, description], i) => (
              <div key={i} className="shortcut-row">
                <dt>
                  {keys.map((key, index) => (
                    <kbd key={index}>{label(key)}</kbd>
                  ))}
                </dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Dialog>
  );
}
