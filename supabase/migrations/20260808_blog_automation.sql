-- ============================================================
-- Blog Automation Schema
-- Run this in Supabase SQL editor OR via `supabase db push`
-- ============================================================

-- 1. Blog posts table
create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  meta_description text not null,
  city text,                          -- e.g. 'Jaipur' (null for generic posts)
  category text default 'saree',      -- saree, lehenga, kurti, etc. — extend later
  content_html text not null,
  content_markdown text,
  keywords text[] default '{}',
  cta_text text,                      -- conversion CTA shown at end of post
  status text not null default 'published' check (status in ('draft','published','failed')),
  ai_generated boolean default true,
  generation_prompt_version text default 'v1',
  created_at timestamptz default now(),
  published_at timestamptz
);

create index if not exists idx_blog_posts_city on blog_posts (city);
create index if not exists idx_blog_posts_status on blog_posts (status);
create index if not exists idx_blog_posts_created_at on blog_posts (created_at desc);

-- 2. Log table — isse aap dekh sakte ho ki daily automation chal raha hai ya nahi
create table if not exists blog_generation_logs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,             -- 'cron' | 'manual' | 'test'
  city text,
  status text not null,               -- 'success' | 'error'
  post_id uuid references blog_posts(id),
  error_message text,
  duration_ms integer,
  created_at timestamptz default now()
);

create index if not exists idx_logs_created_at on blog_generation_logs (created_at desc);

-- 3. Simple table to track which city+category combos are already covered
--    so the daily job doesn't repeat the same city every day
create table if not exists blog_city_queue (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  category text not null default 'saree',
  is_used boolean default false,
  used_at timestamptz,
  unique (city, category)
);

-- Seed top Indian cities for saree SEO (edit/add as needed)
insert into blog_city_queue (city, category)
values
  ('Mumbai','saree'),('Delhi','saree'),('Bangalore','saree'),('Hyderabad','saree'),
  ('Ahmedabad','saree'),('Chennai','saree'),('Kolkata','saree'),('Pune','saree'),
  ('Jaipur','saree'),('Surat','saree'),('Lucknow','saree'),('Kanpur','saree'),
  ('Nagpur','saree'),('Indore','saree'),('Bhopal','saree'),('Patna','saree'),
  ('Vadodara','saree'),('Ghaziabad','saree'),('Ludhiana','saree'),('Agra','saree'),
  ('Varanasi','saree'),('Coimbatore','saree'),('Kochi','saree'),('Guwahati','saree'),
  ('Chandigarh','saree'),('Nashik','saree'),('Rajkot','saree'),('Amritsar','saree'),
  ('Vishakhapatnam','saree'),('Bhubaneswar','saree')
on conflict (city, category) do nothing;
