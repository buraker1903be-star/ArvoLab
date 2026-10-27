"use client";

import Dialog from "@/app/dashboard/_components/dialog";

// Editörün (Tiptap varsayılanları + ArvoLab eklemeleri) klavye kısayolları.
const SHORTCUTS: [string[], string][] = [
  [["Mod", "S"], "Şimdi kaydet (zaten otomatik kaydedilir)"],
  [["Mod", "P"], "Yazdır / PDF (kılavuz düzeninde, sayfalı)"],
  [["Mod", "F"], "Bul ve değiştir"],
  [["Mod", "Z"], "Geri al"],
  [["Mod", "Y"], "Yinele (Mod+Shift+Z de olur)"],
  [["Mod", "B"], "Kalın"],
  [["Mod", "I"], "İtalik"],
  [["Mod", "U"], "Altı çizili"],
  [["Mod", "."], "Üst simge"],
  [["Mod", "L"], "Sola hizala"],
  [["Mod", "E"], "Ortala"],
  [["Mod", "R"], "Sağa hizala"],
  [["Mod", "J"], "İki yana yasla"],
  [["Mod", "]"], "Yazıyı bir punto büyüt (Mod+[ küçült)"],
  [["Mod", "Alt", "1"], "Başlık 1 (2 ve 3 için aynı)"],
  [["Mod", "Alt", "0"], "Normal metne dön"],
  [["Mod", "Shift", "8"], "Madde işaretli liste"],
  [["Mod", "Shift", "7"], "Numaralı liste"],
  [["Mod", "Shift", "B"], "Alıntı"],
  [["#", "Boşluk"], "Satır başında: Başlık 1 (## ve ### ile Başlık 2 ve 3)"],
  [["-", "Boşluk"], "Satır başında: madde işaretli liste"],
  [["1.", "Boşluk"], "Satır başında: numaralı liste"],
  [[">", "Boşluk"], "Satır başında: alıntı"],
  [["Shift", "Enter"], "Aynı paragrafta alt satıra geç"],
  // Tablo kısayolları hiçbir yerde yazmıyordu; kullanıcı son hücrede Tab'a
  // basınca satır açıldığını tesadüfen öğreniyordu.
  [["Tab"], "Paragraf başında ilk satır girintisi; metin içinde sekme"],
  [["Shift", "Tab"], "Paragraf başında girintiyi kaldır"],
  [["Backspace"], "Girintili paragrafın başında: önce girintiyi kaldır"],
  [["Tab"], "Listede: maddeyi içeri al (Shift+Tab: dışarı)"],
  [["Tab"], "Tabloda sonraki hücre (son hücrede: yeni satır; Shift+Tab: önceki)"],
  [["Mod", "Enter"], "Dipnot penceresinde kaydet"],
  [["Enter"], "Bul kutusunda sonraki eşleşme (Shift+Enter: önceki)"],
  [["Esc"], "Açık pencereyi ya da bul çubuğunu kapat"],
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
    <Dialog open={open} onClose={onClose} kicker="Yardım" title="Klavye kısayolları" description="Fareye uzanmadan daha hızlı yazın.">
      <dl className="shortcut-list">
        {SHORTCUTS.map(([keys, description], i) => (
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
    </Dialog>
  );
}
