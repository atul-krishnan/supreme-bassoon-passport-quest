create table if not exists public.api_request_metrics (
  id uuid primary key default extensions.gen_random_uuid(),
  request_id uuid not null,
  route text not null,
  method text not null,
  status_code integer not null check (status_code >= 100 and status_code <= 599),
  latency_ms integer not null check (latency_ms >= 0),
  user_id uuid references auth.users(id) on delete set null,
  release_sha text not null,
  created_at timestamptz not null default now()
);

create index if not exists api_request_metrics_route_created_idx
  on public.api_request_metrics(route, created_at desc);

create index if not exists api_request_metrics_method_route_created_idx
  on public.api_request_metrics(method, route, created_at desc);

create unique index if not exists api_request_metrics_request_route_uidx
  on public.api_request_metrics(request_id, method, route);

alter table public.api_request_metrics enable row level security;
