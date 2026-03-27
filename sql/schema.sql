-- Supabase Schema for Elite Car Maintenance System

-- 1. Create the orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    customer_info TEXT NOT NULL,
    car_plate TEXT NOT NULL,
    car_model TEXT NOT NULL,
    services JSONB DEFAULT '[]'::jsonb,
    total_amount NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending_payment',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by TEXT,
    logs JSONB DEFAULT '[]'::jsonb
);

-- 2. Turn on Row Level Security (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 3. Create a policy that allows all operations for unauthenticated users (for simple MVP development)
CREATE POLICY "Allow anon all" ON public.orders FOR ALL USING (true);
