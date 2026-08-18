import { createAdminClient } from "@/lib/supabase/admin";
import { ensureYokAtlasDirectory } from "@/lib/yok-atlas-directory";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: universities, error } = await admin
    .from("universities")
    .select("id, name, academic_units(source_checked_at, source_url)")
    .order("name");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const candidates = (universities ?? [])
    .map((university) => {
      const yokChecks = (university.academic_units ?? [])
        .filter((unit) => unit.source_url === "https://yokatlas.yok.gov.tr/")
        .map((unit) => unit.source_checked_at)
        .filter((value): value is string => Boolean(value))
        .sort();
      return { ...university, lastCheckedAt: yokChecks.at(-1) ?? null };
    })
    .sort((a, b) => (a.lastCheckedAt ?? "").localeCompare(b.lastCheckedAt ?? ""))
    .slice(0, 5);

  const results: Array<Record<string, unknown>> = [];
  for (const university of candidates) {
    try {
      const result = await ensureYokAtlasDirectory(university.id, university.name);
      results.push({ university: university.name, ...result });
    } catch (syncError) {
      results.push({
        university: university.name,
        status: "failed",
        error: syncError instanceof Error ? syncError.message : "Bilinmeyen hata",
      });
    }
  }

  return Response.json({ checked: results.length, results });
}
