-- 1. Add Avatar to Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Create Services Table
CREATE TABLE IF NOT EXISTS public.services (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    price numeric not null default 0,
    icon text default 'fa-wrench',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users (or anon if needed)
CREATE POLICY "Allow public read access on services" ON public.services FOR SELECT USING (true);

-- Allow full access to anon/authenticated for MVP (Ideally, we would restrict insert/update/delete to admins)
-- Since MVP relies on the web-app logic for role blocking, we just allow operations.
CREATE POLICY "Allow all operations on services" ON public.services FOR ALL USING (true);

-- Insert Default Services
INSERT INTO public.services (name, price, icon) VALUES 
('فحص كمبيوتر شامل', 150, 'fa-laptop-medical'),
('تغيير زيت وفلتر', 250, 'fa-oil-can'),
('تغيير فحمات فرامل', 300, 'fa-car-burst'),
('وزن أذرعة ومقاصات', 120, 'fa-wrench'),
('تنظيف دورة البخاخات', 200, 'fa-spray-can'),
('شحن فريون وتشييك المكيف', 180, 'fa-snowflake'),
('فحص دوري ونقاط عامة', 100, 'fa-clipboard-check');
