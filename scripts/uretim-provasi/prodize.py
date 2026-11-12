import json,re,sys
K=json.load(open(sys.argv[1]))
L={"a":"insert","r":"select","w":"update","d":"delete","D":"truncate","x":"references","t":"trigger","m":"maintain","X":"execute","U":"usage"}
def parse(acl):
    out={}
    for e in acl.strip("{}").split(","):
        if "=" not in e: continue
        r,rest=e.split("=",1); out[r or "public"]=rest.split("/")[0].replace("*","")
    return out
q=lambda s: '"'+s.replace('"','""')+'"'
sql=["begin;"]
# a) Production'da olmayan nesneler
sql+=["drop trigger if exists eposta_onayinda_sifreyi_temizle on auth.users;","drop trigger if exists eposta_onayinda_profili_kur on auth.users;",
"drop trigger if exists set_academic_unit_updated_at_trigger on public.academic_units;","drop trigger if exists validate_academic_unit_parent_trigger on public.academic_units;",
"drop trigger if exists guard_support_request_update_trigger on public.app_support_requests;","drop trigger if exists guard_consultancy_request_update_trigger on public.consultancy_requests;",
"drop function if exists public.eposta_onayinda_sifreyi_temizle();","drop function if exists public.eposta_onayinda_profili_kur();","drop function if exists public.ilk_sifre_gerekli();",
"drop function if exists public.set_academic_unit_updated_at();","drop function if exists public.validate_academic_unit_parent();",
'drop policy if exists "Authenticated users can view universities" on public.universities;',
"drop index if exists public.individual_subscriptions_hatirlatma_idx;","alter table public.individual_subscriptions drop column if exists deneme_hatirlatildi_at;",
"alter table public.profiles drop column if exists kvkk_onay_at;","alter table public.profiles alter column role set default 'employee';"]
# b) Fonksiyon gövdeleri: Production'ın birebir tanımı
for k,v in sorted(K["fn"].items()):
    sql.append(v["def"].rstrip("\n").rstrip(";")+";")
# c) organizations politikası Production biçiminde
p=K["pol"]["public.organizations.Members can view their own organization"]
sql.append('drop policy if exists "Members can view their own organization" on public.organizations;')
sql.append(f'create policy "Members can view their own organization" on public.organizations as {p["permissive"].lower()} for {p["cmd"].lower()} to authenticated using ({p["qual"]});')
# f) Yetkiler
roles="public, anon, authenticated, service_role"
for t,acl in sorted(K["tblacl"].items()):
    sql.append(f"do $$ begin if to_regclass('public.{q(t)}') is not null then execute 'revoke all on public.{q(t)} from {roles}'; end if; end $$;")
    if acl=="DEFAULT": continue
    for r,priv in parse(acl).items():
        if r in ("postgres","supabase_admin"): continue
        ps=",".join(L[c] for c in priv if c in L)
        if ps: sql.append(f"do $$ begin if to_regclass('public.{q(t)}') is not null then execute 'grant {ps} on public.{q(t)} to {r}'; end if; end $$;")
# sütun yetkileri: önce hepsini kaldır
sql.append("""do $$ declare r record; begin for r in select c.relname, a.attname from pg_attribute a join pg_class c on c.oid=a.attrelid where c.relnamespace='public'::regnamespace and a.attacl is not null loop
 execute format('revoke all (%I) on public.%I from public, anon, authenticated, service_role', r.attname, r.relname); end loop; end $$;""")
for k,acl in sorted(K["colacl"].items()):
    t,c=k.split(".",1)
    for r,priv in parse(acl).items():
        if r=="postgres": continue
        ps=",".join(f"{L[x]} ({q(c)})" for x in priv if x in L)
        sql.append(f"grant {ps} on public.{q(t)} to {r};")
for k,v in sorted(K["fn"].items()):
    name=k
    sql.append(f"revoke all on function public.{name} from {roles};")
    acl=v["acl"]
    if acl=="DEFAULT": sql.append(f"grant execute on function public.{name} to public;"); continue
    for r,priv in parse(acl).items():
        if r in ("postgres","supabase_admin"): continue
        if "X" in priv: sql.append(f"grant execute on function public.{name} to {r};")
# varsayılan yetkiler (postgres, public)
sql+=["alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;",
"alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;",
"alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated, service_role;"]
for role,ns,typ,acl in K["defacl"]:
    if role!="postgres" or ns!="public": continue
    obj={"r":"tables","S":"sequences","f":"functions"}[typ]
    for r,priv in parse(acl).items():
        if r=="postgres": continue
        ps=",".join(L[c] for c in priv if c in L)
        if ps: sql.append(f"alter default privileges for role postgres in schema public grant {ps} on {obj} to {r};")
sql.append("commit;")
open(sys.argv[2],"w").write("\n".join(sql)+"\n")
print(len(sql),"ifade")
