import type { Transaction } from "@tiptap/pm/state";

/*
  Editörün "update" olayı belgeyi kirletti mi (kaydedilmemiş değişiklik var mı)?

  Tiptap "update" olayını yalnızca belge değiştiğinde yaymıyor:
  `editor.setEditable(x)` ikinci argüman verilmezse belge AYNIYKEN de boş
  bir işlemle (`state.tr`) "update" yayıyor. Yazım editörü açılışta taslak
  teklifi/uyumsuz içerik için setEditable çağırdığından, 14.11.2026'ya kadar
  her açılışta hiçbir etkileşim olmadan bir saveManuscript gidiyordu:
  `updated_at` yalnızca belge açıldı diye değişiyor, aynı belgeyi daha önce
  açmış ikinci sekme ilk gerçek kaydında yanlış "başka bir sekmede
  değiştirildi" çakışmasına düşüyordu (expectedUpdatedAt eşleşmiyor).

  Ölçüt, Tiptap'ın kendi dispatchTransaction ölçütüyle aynı: kök işlem ya
  da eklenen işlemlerden (appendTransaction) biri belgeyi değiştirdiyse.
  Yalnızca kök işleme bakmak, belgeyi appendTransaction ile düzelten bir
  eklentinin (ör. tablo onarımı) değişikliğini kaydetmemek olurdu.

  Bilerek `addToHistory`'ye BAKILMIYOR: şablon kurma, ön sayfa ekleme gibi
  geri alma geçmişine girmeyen ama belgeyi gerçekten değiştiren işlemler de
  kaydedilmeli.
*/
export function belgeyiKirletirMi(olay: {
  transaction: Pick<Transaction, "docChanged">;
  appendedTransactions?: readonly Pick<Transaction, "docChanged">[];
}): boolean {
  if (olay.transaction.docChanged) return true;
  return (olay.appendedTransactions ?? []).some((tr) => tr.docChanged);
}
