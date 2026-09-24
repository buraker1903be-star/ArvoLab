import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { computeAttention, type AttentionProject } from "../../lib/attention";
import { applyProjectFilters, parseProjectFilters } from "../../lib/project-filters";

/*
  lib/attention.ts'in kendi vaadi: "Her madde Çalışmalarım listesini İLGİLİ
  FİLTREYLE açar." Bu test tam olarak onu sınıyor — sayaçtaki rakam, adresin
  açtığı listenin uzunluğuna EŞİT olmalı.

  İkisi tutmuyordu: "Kontrolör onayı bekliyor" sayacı onaylanmamışları
  sayıyor ama "durum=ready" adresi onaylanmışları da açıyordu; "Yanıt
  bekleyen yorumu var" sayacı yorumu olanları sayıyor ama adres bütün aktif
  çalışmaları açıyordu. Kullanıcı sayıyla listeyi eşleştiremiyordu.
*/

const SIMDI = new Date("2026-09-25T12:00:00+03:00");
const gun = (fark: number) =>
  new Date(SIMDI.getTime() + fark * 86400000).toISOString().slice(0, 10);

type Kayit = AttentionProject & Parameters<typeof applyProjectFilters>[0][number];

const proje = (parca: Partial<Kayit>): Kayit => ({
  id: "p",
  title: "Çalışma",
  university: null,
  status: "writing",
  due_date: null,
  created_at: "2026-01-01T00:00:00Z",
  assignee_id: null,
  assignee_name: null,
  controller_approved_at: null,
  ...parca,
});

const PROJELER: Kayit[] = [
  proje({ id: "gecikmis", due_date: gun(-5), assignee_id: "u1" }),
  proje({ id: "yaklasan", due_date: gun(3), assignee_id: "u1" }),
  proje({ id: "uzak", due_date: gun(40), assignee_id: "u1" }),
  proje({ id: "sorumsuz" }),
  proje({ id: "hazir-onaysiz", status: "ready", assignee_id: "u1" }),
  proje({ id: "hazir-onayli", status: "ready", assignee_id: "u1", controller_approved_at: "2026-09-20T00:00:00Z" }),
  proje({ id: "yorumlu", assignee_id: "u1" }),
  // Teslim edilmiş çalışma hiçbir sayaca girmemeli.
  proje({ id: "teslim", status: "delivered", due_date: gun(-90), assignee_id: "u1" }),
];

const YORUMLAR = new Map([["yorumlu", 2]]);
const DURUMLAR = ["new", "planned", "writing", "analysis", "review", "revision", "turnitin", "ready", "delivered", "archived"];

/** Adresteki sorgu parametrelerini filtreye çevirip listeyi uygular. */
function adresinActigiListe(href: string) {
  const sorgu = new URLSearchParams(href.split("?")[1] ?? "");
  const filtreler = parseProjectFilters(Object.fromEntries(sorgu.entries()), DURUMLAR);
  return applyProjectFilters(PROJELER, filtreler, {
    lastEdited: () => undefined,
    openComments: (id) => YORUMLAR.get(id) ?? 0,
    canFilterAssignee: true,
    now: SIMDI,
  });
}

describe("dikkat sayaçları bağlandıkları filtreyle tutuyor", () => {
  const maddeler = computeAttention(PROJELER, YORUMLAR, { includeUnassigned: true, now: SIMDI });

  test("beş maddenin hepsi üretiliyor", () => {
    assert.deepEqual(maddeler.map((m) => m.id).sort(), ["approval", "comments", "due-soon", "overdue", "unassigned"]);
  });

  for (const madde of maddeler) {
    test(`"${madde.label}" sayacı (${madde.count}) adresin açtığı listeyle eşit`, () => {
      assert.equal(adresinActigiListe(madde.href).length, madde.count);
    });
  }

  /* Sayıların doğruluğu ayrıca sabitleniyor; ikisi birden yanlış olup
     yine de birbirine eşit olabilirdi. */
  test("sayılar beklenen çalışmaları gösteriyor", () => {
    const say = (id: string) => maddeler.find((m) => m.id === id)?.count;
    assert.equal(say("overdue"), 1, "teslim edilmiş gecikmiş çalışma sayılmamalı");
    assert.equal(say("due-soon"), 1);
    assert.equal(say("unassigned"), 1);
    assert.equal(say("approval"), 1, "onaylanmış 'ready' çalışma sayılmamalı");
    assert.equal(say("comments"), 1);
  });

  test("onay filtresi onaylanmış çalışmayı dışarıda bırakıyor", () => {
    const liste = adresinActigiListe("/dashboard/editor?durum=ready&onay=bekliyor");
    assert.deepEqual(liste.map((p) => p.id), ["hazir-onaysiz"]);
  });

  test("yorum filtresi yalnızca yorumu olanı getiriyor", () => {
    const liste = adresinActigiListe("/dashboard/editor?durum=aktif&yorum=acik&sirala=duzenleme");
    assert.deepEqual(liste.map((p) => p.id), ["yorumlu"]);
  });

  test("tanınmayan filtre değeri varsayılana düşüyor", () => {
    assert.equal(adresinActigiListe("/dashboard/editor?onay=palavra").length, PROJELER.length);
  });
});
