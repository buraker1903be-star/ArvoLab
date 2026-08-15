import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const sources = JSON.parse(fs.readFileSync(path.join(directory, "sources.tr.json"), "utf8"));
const sqlString = (value) => value == null ? "null" : `'${String(value).replaceAll("'", "''")}'`;

const values = sources.map((source) => `(
  ${sqlString(source.universityName)}, ${sqlString(source.instituteName)},
  ${sqlString(source.documentTitle)}, ${sqlString(source.versionLabel)},
  ${sqlString(source.effectiveFrom)}::date, ${sqlString(source.sourceUrl)},
  ${sqlString(`${source.statusNote} Kaynak doğrulama: ${source.verifiedAt}.`)}
)`).join(",\n");

const sql = `-- Doğrulanmış resmî kılavuz kaynakları. Yeni kayıtlar insan onayı bekler.
with source_data(university_name, institute_name, document_title, version_label, effective_from, source_url, review_notes) as (
  values ${values}
)
insert into public.thesis_guidelines (
  university_name, institute_name, document_title, version_label, effective_from,
  source_url, university_id, academic_unit_id, analysis_status, review_notes, is_active
)
select
  s.university_name, s.institute_name, s.document_title, s.version_label, s.effective_from,
  s.source_url, u.id, au.id, 'needs_review', s.review_notes, true
from source_data s
join public.universities u on lower(trim(u.name)) = lower(trim(s.university_name))
left join public.academic_units au
  on au.university_id = u.id
 and s.institute_name is not null
 and lower(trim(au.name)) = lower(trim(s.institute_name))
where not exists (
  select 1 from public.thesis_guidelines existing where existing.source_url = s.source_url
);
`;

process.stdout.write(sql);
