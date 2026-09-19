# Sinf Yordamchisi

Sinf rahbari va klasskom uchun kunlik yo'qlama, o'quvchilar ro'yxati, navbatchilar
jadvali va (faqat klasskomga ko'rinadigan) pul yig'imi paneli.

Ishga tushirish uchun **SETUP.md** ga qarang.

- **Stack:** Next.js (App Router) + Supabase (auth + Postgres) + Tailwind CSS
- **Rollar:** `teacher` (sinf rahbari) va `klasskom` (o'qituvchi tomonidan yaratiladi)
- **Xavfsizlik:** rollar orasidagi cheklovlar Supabase Row Level Security orqali
  ma'lumotlar bazasi darajasida amalga oshirilgan — frontend kodini chetlab
  o'tib bo'lmaydi.
