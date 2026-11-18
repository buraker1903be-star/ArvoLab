# Uzak dal temizliği (18.11.2026)

Kural (kullanıcı): yalnızca birleşmiş PR'ının head SHA'sı dalın bugünkü HEAD'iyle birebir aynı olan
VE `design/os5` @ `a08b61d`'nin tamamen atası olan dallar silinir. Korunanlar: `main`, `design/os5`,
açık PR dalları (#8, #71, #75, #96), kabul raporu dalları (`hazirlik/rc06*`), oturumun geliştirme dalı.
Birleşmiş ama ata olmayan (squash/rebase ile girmiş olabilecek) dallar incelenmeden silinmez — korundu.

- `uzak-dallar-oncesi.txt`: silmeden önceki 153 uzak dalın tam SHA listesi (`git ls-remote --heads`).
- `pr.tsv`: PR numarası, head dalı, head SHA, durum (GitHub, 107 PR).
- `silinecek.tsv`: silme adayı dal, tam SHA, PR.
- `korunan.tsv`: korunan dal, tam SHA, gerekçe.
- Silme `--force-with-lease=<dal>:<SHA>` ile yapılır: HEAD silme anında değişmişse push reddedilir, dal atlanır.
- Geri getirme: `git push origin <SHA>:refs/heads/<dal>` (commit'ler `design/os5` geçmişinde).
