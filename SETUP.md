# Ishga tushirish qo'llanmasi

## 1. Supabase loyihasi

1. [supabase.com](https://supabase.com) da yangi loyiha yarating.
2. **SQL Editor** ga o'ting va `lib/supabase-schema.sql` faylining butun mazmunini joylashtirib ishga tushiring.
3. **Project Settings -> API** bo'limidan uchta qiymatni oling:
   - Project URL
   - `anon` `public` key
   - `service_role` key (maxfiy)

## 2. Sinf va o'qituvchi hisobini yaratish (bir marotaba)

1. SQL Editor'da:
   ```sql
   insert into public.class_settings (name) values ('9-B sinf') returning id;
   ```
   Qaytgan `id` ni saqlab qo'ying.
2. **Authentication -> Users -> Add user** bo'limida o'qituvchi uchun foydalanuvchi yarating:
   - Email: `<login>@sinf.local` (masalan `ustoz1@sinf.local`)
   - Password: xohlagan parol
   - Yaratilgan foydalanuvchining **User UID** sini nusxalang.
3. SQL Editor'da (qiymatlarni almashtirib):
   ```sql
   insert into public.profiles (id, first_name, last_name, username, role, class_id)
   values ('<TEACHER_USER_UID>', 'Ism', 'Familiya', 'ustoz1', 'teacher', '<CLASS_ID>');
   ```

Shundan so'ng o'qituvchi saytga `ustoz1` login va o'sha parol bilan kiradi va ilova ichidan **Klasskom** bo'limida o'quvchi uchun login/parol yaratadi.

## 3. Vercel'ga joylash

1. GitHub repo'ni Vercel'ga import qiling.
2. **Environment Variables** bo'limiga `.env.example` dagi 3 ta qiymatni real ma'lumotlar bilan kiriting.
3. Deploy qiling.

## Eslatma: maxfiylik

- `SUPABASE_SERVICE_ROLE_KEY` faqat serverda (`app/actions/klasskom.ts`) ishlatiladi va brauzerga hech qachon yuborilmaydi.
- `payments` (pul yig'imi) jadvali ma'lumotlar bazasi darajasida (RLS) faqat `klasskom` roliga ochiq — o'qituvchi hisobi bu ma'lumotlarni hech qanday yo'l bilan ko'ra olmaydi.
