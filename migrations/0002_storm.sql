-- STORM PATH per-user places, routes, prefs. user_id TEXT.
create table if not exists storm_prefs (
  user_id text primary key,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists storm_places (
  id text primary key,
  user_id text not null,
  name text not null,
  lat double precision not null,
  lon double precision not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists storm_places_user_idx on storm_places (user_id, created_at desc);

create table if not exists storm_routes (
  id text primary key,
  user_id text not null,
  name text not null,
  origin text not null,
  dest text not null,
  origin_lat double precision not null,
  origin_lon double precision not null,
  dest_lat double precision not null,
  dest_lon double precision not null,
  distance_m double precision not null default 0,
  duration_s double precision not null default 0,
  gale_score double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists storm_routes_user_idx on storm_routes (user_id, created_at desc);

create table if not exists storm_reports (
  id text primary key,
  user_id text not null,
  kind text not null,
  lat double precision not null,
  lon double precision not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists storm_reports_user_idx on storm_reports (user_id, created_at desc);
