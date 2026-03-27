-- اضافة عمود موعد التسليم
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMP WITH TIME ZONE;
