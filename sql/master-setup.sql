-- ==========================================================
-- SETUP SCRIPT FOR AMAN CAR MAINTENANCE SYSTEM (SUPABASE)
-- ==========================================================
-- يرجى نسخ هذا الكود بالكامل ولصقه في قسم (SQL Editor) بمنصة Supabase والضغط على Run.

-- 1. جدول الموظفين والصلاحيات (Profiles) المرتبط بـ Auth
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'reception',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ALL on profiles" ON public.profiles FOR ALL USING (true);

-- الدالة المسؤولة عن تسجيل بيانات الموظفين فور اعتماد حسابهم
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'role');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. جدول الخدمات والتسعير (Services)
CREATE TABLE IF NOT EXISTS public.services (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    price numeric not null default 0,
    icon text default 'fa-wrench',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ALL on services" ON public.services FOR ALL USING (true);

-- حقن بعض الخدمات الافتراضية إذا كان الجدول فارغاً
INSERT INTO public.services (name, price, icon) 
SELECT 'فحص كمبيوتر شامل', 150, 'fa-laptop-medical' WHERE NOT EXISTS (SELECT 1 FROM public.services LIMIT 1);
INSERT INTO public.services (name, price, icon) 
SELECT 'تغيير زيت وفلتر', 250, 'fa-oil-can' WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'تغيير زيت وفلتر');
INSERT INTO public.services (name, price, icon) 
SELECT 'تغيير فحمات فرامل', 300, 'fa-car-burst' WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'تغيير فحمات فرامل');


-- 3. جدول أوامر التشغيل الأساسي (Orders)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    customer_info TEXT NOT NULL,
    car_plate TEXT NOT NULL,
    car_model TEXT NOT NULL,
    services JSONB DEFAULT '[]'::jsonb,
    total_amount NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    labor_cost NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'pending_payment',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by TEXT,
    logs JSONB DEFAULT '[]'::jsonb
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow ALL on orders" ON public.orders FOR ALL USING (true);
