-- Row Level Security.
-- Public (anon / authenticated Supabase roles) can only read approved, published
-- financial data. No public role has INSERT/UPDATE/DELETE policies, so all writes
-- are denied to them. Administrative writes are performed server-side by the
-- application connection (DATABASE_URL) only after the admin session is verified.

-- Supabase already provides these roles; create them for plain PostgreSQL.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

-- Allow the application's connection role to drop privileges per query.
do $$
begin
  execute format('grant anon to %I', current_user);
exception when others then
  raise notice 'Could not grant anon to %: %', current_user, sqlerrm;
end $$;

grant usage on schema public to anon, authenticated;
grant usage on schema extensions to anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
grant select on public.banks, public.sources, public.categories, public.merchants,
  public.credit_cards, public.deals, public.deal_cards to anon, authenticated;
grant execute on function public.dh_normalize(text) to anon, authenticated;

alter table public.banks enable row level security;
alter table public.sources enable row level security;
alter table public.categories enable row level security;
alter table public.merchants enable row level security;
alter table public.credit_cards enable row level security;
alter table public.deals enable row level security;
alter table public.deal_cards enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_audit_log enable row level security;

create policy banks_public_read on public.banks for select to anon, authenticated using (true);
create policy categories_public_read on public.categories for select to anon, authenticated using (true);
create policy merchants_public_read on public.merchants for select to anon, authenticated using (true);

create policy cards_public_read on public.credit_cards for select to anon, authenticated
  using (verification_status = 'verified' and is_active);

create policy deals_public_read on public.deals for select to anon, authenticated
  using (publication_status = 'published' and verification_status = 'verified');

create policy deal_cards_public_read on public.deal_cards for select to anon, authenticated
  using (
    exists (select 1 from public.deals d where d.id = deal_id
            and d.publication_status = 'published' and d.verification_status = 'verified')
    and exists (select 1 from public.credit_cards c where c.id = card_id
            and c.verification_status = 'verified' and c.is_active)
  );

-- Only reviewed sources are public.
create policy sources_public_read on public.sources for select to anon, authenticated
  using (verified_at is not null);

-- admin_users / admin_audit_log: no policies => no public access.
