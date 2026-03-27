-- Update the existing 'orders' table to support the new billing & notes features

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS labor_cost numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- We don't need to alter 'services' column type because it's JSONB and can comfortably hold {id, name, price, qty}.

-- Note: Ensure that the front-end logic respects these default fields.
