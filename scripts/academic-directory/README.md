# Academic Directory ETL

This tool collects academic unit names from verified official university pages and produces CSV and SQL files for Supabase.

## Commands

```bash
npm run academic-directory:check
npm run academic-directory:crawl
```

## Inputs

- `scripts/academic-directory/sources.json`

Each source must include:

- `universityName`: must match `public.universities.name`
- `officialDomains`: allow-list of official domains
- `pages`: official pages to crawl

The crawler refuses URLs outside the configured official domains.

## Outputs

Generated files are written to `data/academic-directory/`:

- `academic_units.csv`
- `academic_units.sql`
- `crawl-report.json`

The SQL output inserts rows into `public.academic_unit_import_staging` and calls `public.import_academic_units()`.

## Review workflow

1. Run the crawler.
2. Inspect `crawl-report.json` for failed pages.
3. Review `academic_units.csv` for false positives and naming differences.
4. Correct source-specific issues in `sources.json` or the parser.
5. Run the generated SQL in Supabase only after review.

## Data rules

- Only official university domains are accepted.
- Generated rows are deduplicated by university, parent, unit name, and unit type.
- The crawler does not invent missing faculties, institutes, departments, or programs.
- Department and program hierarchy should be added only when a reliable parent relationship is available.
