-- Run this once in Supabase SQL Editor.
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  email text,
  package_id text not null,
  package_name text not null,
  station_name text not null,
  game text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  hours integer not null check (hours between 1 and 6),
  hourly_rate numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  utr text,
  payment_status text not null default 'not_submitted'
    check (payment_status in ('not_submitted','submitted','verified','rejected')),
  status text not null default 'pending_verification'
    check (status in ('pending_verification','confirmed','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists bookings_station_time_idx
on public.bookings (station_name, start_at, end_at);

-- This starter app uses the Supabase service-role key on the server only.
-- Never put the service-role key in browser JavaScript or commit your .env file.
