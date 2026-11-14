-- DealHoi initial schema
-- Monetary values are non-negative integer VND (BIGINT).
-- Timestamps use TIMESTAMPTZ. Display timezone is Asia/Ho_Chi_Minh (handled in the app).

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Immutable wrapper so unaccent can be used in expression indexes.
create or replace function public.dh_normalize(input text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, input))
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.source_type as enum ('official_bank', 'official_merchant', 'other');
create type public.verification_status as enum ('draft', 'verified', 'needs_review', 'rejected');
create type public.publication_status as enum ('draft', 'published', 'withdrawn');
create type public.benefit_type as enum ('cashback', 'discount', 'points', 'installment', 'voucher', 'travel_perk', 'other');
create type public.offer_type as enum ('ongoing', 'temporary', 'welcome');
create type public.cap_period as enum ('transaction', 'month', 'quarter', 'year', 'campaign');
create type public.payment_channel as enum ('online', 'offline', 'both', 'unknown');
create type public.merchant_scope as enum ('specific_merchant', 'category_wide', 'general');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.banks (
  id uuid primary key default extensions.gen_random_uuid(),
  name varchar(200) not null,
  slug varchar(120) not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url text,
  website_url text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default extensions.gen_random_uuid(),
  url text not null unique check (url ~ '^https?://'),
  publisher varchar(200) not null,
  source_type public.source_type not null,
  source_excerpt text,
  published_at timestamptz,
  retrieved_at timestamptz not null,
  verified_at timestamptz,
  verification_notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  name varchar(200) not null,
  slug varchar(120) not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  icon varchar(60),
  description text,
  aliases text[] not null default '{}',
  is_browsable boolean not null default true,
  sort_order integer not null default 100
);

create table public.merchants (
  id uuid primary key default extensions.gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name varchar(200) not null,
  slug varchar(120) not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url text,
  website_url text,
  aliases text[] not null default '{}',
  is_featured boolean not null default false
);

create table public.credit_cards (
  id uuid primary key default extensions.gen_random_uuid(),
  bank_id uuid not null references public.banks(id) on delete restrict,
  name varchar(200) not null,
  slug varchar(120) not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  network varchar(60),
  card_tier varchar(60),
  annual_fee_vnd bigint check (annual_fee_vnd >= 0),
  annual_fee_waiver_terms text,
  minimum_income_vnd bigint check (minimum_income_vnd >= 0),
  description text,
  image_url text,
  official_url text check (official_url is null or official_url ~ '^https?://'),
  source_id uuid references public.sources(id) on delete restrict,
  verification_status public.verification_status not null default 'draft',
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A verified (publicly visible) card must cite a source.
  constraint credit_cards_verified_requires_source
    check (verification_status <> 'verified' or source_id is not null)
);

create table public.deals (
  id uuid primary key default extensions.gen_random_uuid(),
  -- Stable natural key used to detect duplicate imports.
  import_key varchar(160) unique,
  title varchar(300) not null,
  description text not null,
  merchant_id uuid references public.merchants(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  benefit_type public.benefit_type not null,
  offer_type public.offer_type not null,
  percentage numeric(6,3) check (percentage >= 0 and percentage <= 100),
  fixed_amount_vnd bigint check (fixed_amount_vnd >= 0),
  maximum_benefit_vnd bigint check (maximum_benefit_vnd >= 0),
  cap_period public.cap_period,
  cap_is_unlimited boolean,
  -- NULL = unknown. 0 = the source explicitly states there is no minimum.
  minimum_spend_vnd bigint check (minimum_spend_vnd >= 0),
  -- Extension to the base spec: what the minimum spend is measured over. NULL = unknown.
  minimum_spend_period public.cap_period,
  installment_months integer check (installment_months > 0 and installment_months <= 120),
  installment_fee_vnd bigint check (installment_fee_vnd >= 0),
  eligibility_terms text,
  terms_and_conditions text,
  payment_channel public.payment_channel not null default 'unknown',
  merchant_scope public.merchant_scope not null,
  start_date date,
  end_date date,
  source_id uuid references public.sources(id) on delete restrict,
  verification_status public.verification_status not null default 'draft',
  publication_status public.publication_status not null default 'draft',
  is_featured boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_valid_date_range check (start_date is null or end_date is null or end_date >= start_date),
  constraint deals_unlimited_cap_has_no_amount check (cap_is_unlimited is not true or maximum_benefit_vnd is null),
  constraint deals_specific_merchant_requires_merchant check (merchant_scope <> 'specific_merchant' or merchant_id is not null),
  constraint deals_published_requires_source check (publication_status <> 'published' or source_id is not null),
  constraint deals_published_requires_verified check (publication_status <> 'published' or verification_status = 'verified')
);

create table public.deal_cards (
  deal_id uuid not null references public.deals(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id) on delete restrict,
  additional_eligibility_terms text,
  primary key (deal_id, card_id)
);

-- Administrators (Supabase Auth user ids or emails for the env-based provider).
create table public.admin_users (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid unique,
  email varchar(320) not null unique,
  created_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_email varchar(320) not null,
  action varchar(80) not null,
  entity_type varchar(40) not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.dh_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger credit_cards_touch before update on public.credit_cards
  for each row execute function public.dh_touch_updated_at();
create trigger deals_touch before update on public.deals
  for each row execute function public.dh_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Cross-table publication rules (checked at COMMIT so a deal and its card
-- mappings can be written in one transaction).
--   * A published deal must cite a reviewed source (verified_at not null).
--   * A published deal must have at least one eligible card.
--   * A verified card must cite a reviewed source.
-- ---------------------------------------------------------------------------
create or replace function public.dh_check_deal_publishable(p_deal_id uuid)
returns void language plpgsql as $$
declare
  d record;
  card_count integer;
  src_verified timestamptz;
begin
  select id, publication_status, source_id into d from public.deals where id = p_deal_id;
  if not found or d.publication_status <> 'published' then
    return;
  end if;
  select verified_at into src_verified from public.sources where id = d.source_id;
  if src_verified is null then
    raise exception 'Deal % cannot be published: its source has not been reviewed (verified_at is null)', p_deal_id
      using errcode = 'check_violation';
  end if;
  select count(*) into card_count from public.deal_cards where deal_id = p_deal_id;
  if card_count = 0 then
    raise exception 'Deal % cannot be published without at least one eligible credit card', p_deal_id
      using errcode = 'check_violation';
  end if;
end $$;

create or replace function public.dh_deals_publish_trigger()
returns trigger language plpgsql as $$
begin
  perform public.dh_check_deal_publishable(new.id);
  return null;
end $$;

create or replace function public.dh_deal_cards_publish_trigger()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.dh_check_deal_publishable(old.deal_id);
  else
    perform public.dh_check_deal_publishable(new.deal_id);
    if tg_op = 'UPDATE' and old.deal_id <> new.deal_id then
      perform public.dh_check_deal_publishable(old.deal_id);
    end if;
  end if;
  return null;
end $$;

create constraint trigger deals_publishable
  after insert or update on public.deals
  deferrable initially deferred
  for each row execute function public.dh_deals_publish_trigger();

create constraint trigger deal_cards_publishable
  after insert or update or delete on public.deal_cards
  deferrable initially deferred
  for each row execute function public.dh_deal_cards_publish_trigger();

create or replace function public.dh_cards_source_trigger()
returns trigger language plpgsql as $$
declare
  src_verified timestamptz;
begin
  if new.verification_status = 'verified' then
    select verified_at into src_verified from public.sources where id = new.source_id;
    if src_verified is null then
      raise exception 'Card % cannot be verified: its source has not been reviewed', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return null;
end $$;

create constraint trigger credit_cards_source_reviewed
  after insert or update on public.credit_cards
  deferrable initially deferred
  for each row execute function public.dh_cards_source_trigger();

-- Un-reviewing a source automatically unpublishes what depends on it, so the
-- invariant above can never be bypassed by editing the source afterwards.
create or replace function public.dh_sources_unreview_trigger()
returns trigger language plpgsql as $$
begin
  if new.verified_at is null and old.verified_at is not null then
    update public.deals set publication_status = 'draft', verification_status = 'needs_review'
      where source_id = new.id and publication_status = 'published';
    update public.credit_cards set verification_status = 'needs_review'
      where source_id = new.id and verification_status = 'verified';
  end if;
  return new;
end $$;

create trigger sources_unreview after update on public.sources
  for each row execute function public.dh_sources_unreview_trigger();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index merchants_name_norm_trgm on public.merchants using gin (public.dh_normalize(name) extensions.gin_trgm_ops);
create index merchants_category_idx on public.merchants (category_id);
create index categories_name_norm_trgm on public.categories using gin (public.dh_normalize(name) extensions.gin_trgm_ops);
create index credit_cards_name_norm_trgm on public.credit_cards using gin (public.dh_normalize(name) extensions.gin_trgm_ops);
create index credit_cards_bank_idx on public.credit_cards (bank_id);
create index credit_cards_public_idx on public.credit_cards (verification_status, is_active);
create index deals_merchant_idx on public.deals (merchant_id);
create index deals_category_idx on public.deals (category_id);
create index deals_status_idx on public.deals (publication_status, verification_status);
create index deals_validity_idx on public.deals (start_date, end_date);
create index deals_source_idx on public.deals (source_id);
create index deal_cards_card_idx on public.deal_cards (card_id);
