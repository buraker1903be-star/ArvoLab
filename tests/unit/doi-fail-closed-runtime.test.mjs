import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { registerHooks } from "node:module";

const state = {
  fetchCalls: 0,
  insertCalls: 0,
  insertedRows: [],
  allowInsert: false,
  revalidateCalls: 0,
  allowRevalidate: false,
};

const projectId = "synthetic-project";
const userId = "synthetic-user";

const supabase = {
  from(table) {
    if (table === "academic_projects") {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return { data: { id: projectId }, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    }

    if (table === "literature_sources") {
      return {
        select() {
          return {
            eq() {
              return {
                async eq() {
                  return { data: [], error: null };
                },
              };
            },
          };
        },
        async insert(rows) {
          state.insertCalls++;
          if (!state.allowInsert) {
            throw new Error("TEST: beklenmeyen kaynak yazımı");
          }
          state.insertedRows.push(...rows);
          return { error: null };
        },
      };
    }

    throw new Error(`TEST: beklenmeyen tablo ${table}`);
  },
};

const mocks = new Map([
  ["@/lib/auth-guards", `
    export async function getAuthContext() {
      return globalThis.__doiRuntimeTest.auth();
    }
    export async function oturumYokMesaji() {
      return "Oturum yok";
    }
  `],
  ["@/lib/access", `
    export async function isSubscriptionBlocked() {
      return globalThis.__doiRuntimeTest.subscriptionBlocked;
    }
    export async function abonelikKapaliMesaji() {
      return "Abonelik kapalı";
    }
  `],
  ["@/lib/dil-sunucu", `
    export async function ceviri() {
      return (value) => value.tr;
    }
  `],
  ["@/lib/supabase/admin", `
    export function adminIstemcisiVarsa() {
      return globalThis.__doiRuntimeTest.admin();
    }
  `],
  ["@/lib/supabase/server", `
    export async function createClient() {
      return globalThis.__doiRuntimeTest.supabase;
    }
  `],
  ["next/cache", `
    export function revalidatePath() {
      const state = globalThis.__doiRuntimeTest.state;
      state.revalidateCalls++;
      if (!state.allowRevalidate) {
        throw new Error("TEST: beklenmeyen revalidatePath");
      }
    }
  `],
]);

const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (mocks.has(specifier)) {
      return {
        url: `doi-runtime-mock:${encodeURIComponent(specifier)}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("doi-runtime-mock:")) {
      const specifier = decodeURIComponent(
        url.slice("doi-runtime-mock:".length)
      );
      return {
        format: "module",
        source: mocks.get(specifier),
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

globalThis.__doiRuntimeTest = {
  auth: () => ({
    user: { id: userId },
    supabase,
  }),
  supabase,
  admin: () => null,
  subscriptionBlocked: false,
  state,
};

mock.method(globalThis, "fetch", async (input) => {
  const url = new URL(
    typeof input === "string" ? input : input.url
  );

  assert.equal(
    url.origin,
    "https://api.crossref.org",
    "TEST: beklenmeyen Crossref origin"
  );

  assert.match(
    url.pathname,
    /^\/works\/10\.[0-9]+\/[A-Za-z0-9._~%-]+$/,
    "TEST: beklenmeyen Crossref DOI yolu"
  );

  state.fetchCalls++;
  if (state.allowFetch === true) {
    if (state.crossrefSuccess === true) {
      const doi = state.fetchCalls === 1
        ? "10.1000/test123"
        : "10.1000/test456";

      return {
        status: 200,
        ok: true,
        async json() {
          return {
            message: {
              DOI: doi,
              title: [
                doi === "10.1000/test123"
                  ? "Synthetic Research Alpha"
                  : "Synthetic Research Beta"
              ],
              author: [{ given: "Test", family: "Author" }],
              issued: { "date-parts": [[2026]] },
              type: "journal-article",
            },
          };
        },
      };
    }

    return { status: 404, ok: false };
  }
  throw new Error("TEST: beklenmeyen Crossref isteği");
});

try {
  const { lookupDoi } = await import(
    "../../app/actions/literature.ts"
  );
  const { doiIleEkle } = await import(
    "../../app/actions/kaynak-aktarim.ts"
  );

  for (const blockedBy of ["auth", "subscription"]) {
    for (const action of ["tekli", "toplu"]) {
      test(`D5: erişim engeli ${blockedBy} ${action}`, async () => {
        state.fetchCalls = 0;
        state.insertCalls = 0;

        let rpcCalls = 0;

        globalThis.__doiRuntimeTest.auth = () =>
          blockedBy === "auth"
            ? null
            : { user: { id: userId }, supabase };

        globalThis.__doiRuntimeTest.subscriptionBlocked =
          blockedBy === "subscription";

        globalThis.__doiRuntimeTest.admin = () => ({
          async rpc() {
            rpcCalls++;
            throw new Error("TEST: yetkisiz RPC çağrısı");
          },
        });

        try {
          const result = action === "tekli"
            ? await lookupDoi("10.1000/test123")
            : await doiIleEkle(projectId, [
                "10.1000/test123",
                "10.1000/test456",
              ]);

          assert.equal(
            result.error,
            blockedBy === "auth"
              ? "Oturum yok"
              : "Abonelik kapalı"
          );

          assert.equal(rpcCalls, 0);
          assert.equal(state.fetchCalls, 0);
          assert.equal(state.insertCalls, 0);
        } finally {
          globalThis.__doiRuntimeTest.auth = () => ({
            user: { id: userId },
            supabase,
          });
          globalThis.__doiRuntimeTest.subscriptionBlocked = false;
          globalThis.__doiRuntimeTest.admin = () => null;
        }
      });
    }
  }

  test("D5: sayaç yoksa tekli DOI fail-closed", async () => {
    state.fetchCalls = 0;
    state.insertCalls = 0;

    const result = await lookupDoi("10.1000/test123");

    assert.match(result.error ?? "", /geçici olarak/);
    assert.equal(state.fetchCalls, 0);
    assert.equal(state.insertCalls, 0);
  });

  test("D5: sayaç yoksa toplu DOI fail-closed", async () => {
    state.fetchCalls = 0;
    state.insertCalls = 0;

    const result = await doiIleEkle(projectId, [
      "10.1000/test123",
      "10.1000/test456",
    ]);

    assert.match(result.error ?? "", /geçici olarak/);
    assert.equal(result.ozet?.rezerve, 0);
    assert.equal(result.ozet?.sorgulanan, 0);
    assert.equal(state.fetchCalls, 0);
    assert.equal(state.insertCalls, 0);
  });

  for (const scenario of ["hata", "istisna"]) {
    for (const action of ["tekli", "toplu"]) {
      test(`D5: RPC ${scenario} ${action} DOI fail-closed`, async () => {
        state.fetchCalls = 0;
        state.insertCalls = 0;

        let rpcCalls = 0;

        globalThis.__doiRuntimeTest.admin = () => ({
          async rpc(name, args) {
            rpcCalls++;
            assert.equal(name, "rate_limit_take");
            assert.equal(args.p_limit, 120);
            assert.equal(args.p_requested, action === "tekli" ? 1 : 2);

            if (scenario === "istisna") {
              throw new Error("TEST: RPC bağlantı hatası");
            }

            return {
              data: null,
              error: { message: "TEST: RPC başarısız" },
            };
          },
        });

        try {
          const result = action === "tekli"
            ? await lookupDoi("10.1000/test123")
            : await doiIleEkle(projectId, [
                "10.1000/test123",
                "10.1000/test456",
              ]);

          assert.match(result.error ?? "", /geçici olarak/);
          assert.equal(rpcCalls, 1);
          assert.equal(state.fetchCalls, 0);
          assert.equal(state.insertCalls, 0);

          if (action === "toplu") {
            assert.equal(result.ozet?.rezerve, 0);
            assert.equal(result.ozet?.sorgulanan, 0);
          }
        } finally {
          globalThis.__doiRuntimeTest.admin = () => null;
        }
      });
    }
  }


  for (const scenario of [
    {
      name: "null",
      data: null,
    },
    {
      name: "bos-dizi",
      data: [],
    },
    {
      name: "negatif-hak",
      data: [{ granted: -1, remaining: 100 }],
    },
    {
      name: "fazla-hak",
      data: [{ granted: 999, remaining: 0 }],
    },
  ]) {
    for (const action of ["tekli", "toplu"]) {
      test(`D5: bozuk RPC ${scenario.name} ${action} fail-closed`, async () => {
        state.fetchCalls = 0;
        state.insertCalls = 0;

        let rpcCalls = 0;

        globalThis.__doiRuntimeTest.admin = () => ({
          async rpc(name, args) {
            rpcCalls++;
            assert.equal(name, "rate_limit_take");
            assert.equal(args.p_requested, action === "tekli" ? 1 : 2);
            return { data: scenario.data, error: null };
          },
        });

        try {
          const result = action === "tekli"
            ? await lookupDoi("10.1000/test123")
            : await doiIleEkle(projectId, [
                "10.1000/test123",
                "10.1000/test456",
              ]);

          assert.match(result.error ?? "", /geçici olarak/);
          assert.equal(rpcCalls, 1);
          assert.equal(state.fetchCalls, 0);
          assert.equal(state.insertCalls, 0);

          if (action === "toplu") {
            assert.equal(result.ozet?.rezerve, 0);
            assert.equal(result.ozet?.sorgulanan, 0);
          }
        } finally {
          globalThis.__doiRuntimeTest.admin = () => null;
        }
      });
    }
  }


  for (const scenario of [
    { action: "tekli", granted: 1, expectedFetch: 1 },
    { action: "tekli", granted: 0, expectedFetch: 0 },
    { action: "toplu", granted: 2, expectedFetch: 2 },
    { action: "toplu", granted: 1, expectedFetch: 1 },
  ]) {
    test(`D5: kota kontrollu ${scenario.action} hak=${scenario.granted}`, async () => {
      state.fetchCalls = 0;
      state.insertCalls = 0;
      state.allowFetch = true;

      let rpcCalls = 0;
      const requested = scenario.action === "tekli" ? 1 : 2;

      globalThis.__doiRuntimeTest.admin = () => ({
        async rpc(name, args) {
          rpcCalls++;
          assert.equal(name, "rate_limit_take");
          assert.equal(args.p_requested, requested);
          return {
            data: [{
              granted: scenario.granted,
              remaining: 120 - scenario.granted,
              resets_at: "2026-11-13T07:00:00Z",
            }],
            error: null,
          };
        },
      });

      try {
        const result = scenario.action === "tekli"
          ? await lookupDoi("10.1000/test123")
          : await doiIleEkle(projectId, [
              "10.1000/test123",
              "10.1000/test456",
            ]);

        assert.equal(rpcCalls, 1);
        assert.equal(state.fetchCalls, scenario.expectedFetch);
        assert.equal(state.insertCalls, 0);

        if (scenario.action === "toplu") {
          assert.equal(result.ozet?.rezerve, scenario.granted);
          assert.equal(result.ozet?.sorgulanan, scenario.expectedFetch);
          assert.equal(result.ozet?.ertelenen, requested - scenario.granted);
        } else if (scenario.granted === 0) {
          assert.ok(result.error);
        }
      } finally {
        state.allowFetch = false;
        globalThis.__doiRuntimeTest.admin = () => null;
      }
    });
  }


  for (const granted of [2, 1]) {
    test(`D5: basarili kaynak ekleme hak=${granted}`, async () => {
      Object.assign(state, {
        fetchCalls: 0,
        insertCalls: 0,
        insertedRows: [],
        revalidateCalls: 0,
        allowFetch: true,
        crossrefSuccess: true,
        allowInsert: true,
        allowRevalidate: true,
      });

      let rpcCalls = 0;

      globalThis.__doiRuntimeTest.admin = () => ({
        async rpc(name, args) {
          rpcCalls++;
          assert.equal(name, "rate_limit_take");
          assert.equal(args.p_requested, 2);

          return {
            data: [{
              granted,
              remaining: 120 - granted,
              resets_at: "2026-11-13T07:00:00Z",
            }],
            error: null,
          };
        },
      });

      try {
        const result = await doiIleEkle(projectId, [
          "10.1000/test123",
          "10.1000/test456",
        ]);

        assert.equal(result.error, undefined);
        assert.equal(rpcCalls, 1);
        assert.equal(state.fetchCalls, granted);
        assert.equal(state.insertCalls, 1);
        assert.equal(state.insertedRows.length, granted);

        assert.equal(result.ozet?.rezerve, granted);
        assert.equal(result.ozet?.sorgulanan, granted);
        assert.equal(result.ozet?.ertelenen, 2 - granted);

        for (const [index, row] of state.insertedRows.entries()) {
          assert.equal(row.owner_id, userId);
          assert.equal(row.project_id, projectId);
          assert.equal(row.status, "to_review");

          assert.equal(
            row.doi_or_url,
            index === 0
              ? "10.1000/test123"
              : "10.1000/test456"
          );

          assert.ok(
            row.title?.startsWith("Synthetic Research")
          );
        }

        assert.ok(state.revalidateCalls > 0);
      } finally {
        Object.assign(state, {
          allowFetch: false,
          crossrefSuccess: false,
          allowInsert: false,
          allowRevalidate: false,
        });

        globalThis.__doiRuntimeTest.admin = () => null;
      }
    });
  }

} finally {
  // Testlerin çalışması tamamlanana kadar kancalar gerekli.
}

process.on("exit", () => {
  hook.deregister();
  mock.restoreAll();
  delete globalThis.__doiRuntimeTest;
});
