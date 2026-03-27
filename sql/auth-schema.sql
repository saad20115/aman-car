-- إعداد جداول وصلاحيات الموظفين (User Profiles System)

-- 1. إنشاء جدول ملفات تعريف الموظفين بناءً على جدول المستخدمين الأساسي في Auth
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'reception', -- admin, reception, accountant, technician
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. تفعيل السياسات وصلاحية الرؤية
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. السماح بالقراءة والتعديل (مبسط لتطبيق الـ MVP)
CREATE POLICY "Allow anon all on profiles" ON public.profiles FOR ALL USING (true);

-- 4. برمجة دالة آلية (Trigger Function) لنسخ بيانات الموظف عند تسجيل حسابه الجديد تلقائياً
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'role');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. تشغيل الدالة الآلية بربطها بجدول حسابات Supabase
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- -- --

-- تنبيه: تأكد من الذهاب إلى إعدادات مشروعك في منصة Supabase 
-- مسار: Authentication -> Providers -> Email
-- وقم بتعطيل ميزة (Confirm email) ليتم تفعيل الحسابات الجديدة فوراً بدون إيميل تفعيل.
