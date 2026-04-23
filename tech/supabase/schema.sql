-- Operation PAWS (public repo) — Safe schema: no secrets, no PII seeded

-- 1) Extensions
create extension if not exists pgcrypto;

-- 2) Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'paws_tier') then
    create type paws_tier as enum ('T1','T2','T3');
  end if;

  if not exists (select 1 from pg_type where typname = 'paws_stage') then
    create type paws_stage as enum ('lead','prescreen','saps_assessed','accepted','not_selected','withdrawn');
  end if;

  if not exists (select 1 from pg_type where typname = 'paws_source_kind') then
    create type paws_source_kind as enum ('BREEDER','DONOR');
  end if;
end $$;

-- 3) Sequences
create sequence if not exists paws_serial_seq;
create sequence if not exists paws_breeder_seq;
create sequence if not exists paws_donor_seq;

-- 4) Helper: convert to base36
create or replace function paws_base36_2(n int) returns text language plpgsql immutable as $$
declare
  alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  hi int;
  lo int;
begin
  if n < 0 or n > 1295 then raise exception 'paws_base36_2 out of range: %', n; end if;
  hi := floor(n / 36.0);
  lo := n % 36;
  return substr(alphabet, hi + 1, 1) || substr(alphabet, lo + 1, 1);
end;
$$;

-- 5) Checksum
create or replace function paws_checksum_2(core text) returns text language plpgsql immutable as $$
declare
  h text; x bigint; n int;
begin
  h := encode(digest(core, 'sha256'), 'hex');
  x := ('x' || substr(h, 1, 8))::bit(32)::int;
  n := abs((x % 1296)::int);
  return paws_base36_2(n);
end;
$$;

-- 6) Sources (Public-safe mapping)
create table if not exists paws_sources (
  source_id uuid primary key default gen_random_uuid(),
  kind paws_source_kind not null,
  source_code text unique not null,
  is_public_opt_in boolean not null default false,
  public_display_name text null,
  created_at timestamptz not null default now()
);

-- 7) Public candidate table (NO PII)
create table if not exists paws_candidates_public (
  dog_id uuid primary key default gen_random_uuid(),
  paws_serial bigint not null unique,
  registered_at timestamptz not null default now(),
  reg_mm text not null,
  reg_yyyy text not null,
  tier paws_tier not null,
  source_code text not null references paws_sources(source_code),
  paws_ref text not null unique,
  stage paws_stage not null default 'lead',
  stage_updated_at timestamptz not null default now(),
  age_band text null,
  breed_group text null,
  region text null,
  outcome_reason_category text null,
  campaign_tag text null
);

-- 8) Public Tracker View
create or replace view paws_public_tracker as
select paws_ref, tier, source_code, stage, stage_updated_at, reg_mm, reg_yyyy, campaign_tag, age_band, breed_group, region, outcome_reason_category
from paws_candidates_public;
