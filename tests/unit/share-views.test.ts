import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordShareView } from "@/lib/share-views";

/* Yalnızca recordShareView'un kullandığı iki çağrının taklidi. */
function sahteIstemci(goruntulenme: number) {
  const yazilan: Record<string, unknown>[] = [];
  const istemci = {
    rpc: async () => ({ data: goruntulenme, error: null }),
    from: () => ({
      insert: async (satir: Record<string, unknown>) => {
        yazilan.push(satir);
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  return { istemci, yazilan };
}

const BAGLANTI = { id: "l1", project_id: "p1", created_by: "u1", label: null, view_count: 0 };

test("ilk görüntüleme bildirimi oluşturanın dilinde yazılır", async () => {
  const tr = sahteIstemci(1);
  await recordShareView(tr.istemci, BAGLANTI, "Tez");
  assert.equal(tr.yazilan[0].title, "Paylaşım bağlantınız açıldı");
  assert.equal(tr.yazilan[0].body, "Adsız bağlantı · Tez");

  const en = sahteIstemci(1);
  await recordShareView(en.istemci, BAGLANTI, "Thesis", new Date(), "en");
  assert.equal(en.yazilan[0].title, "Your share link was opened");
  assert.equal(en.yazilan[0].body, "Untitled link · Thesis");
});
