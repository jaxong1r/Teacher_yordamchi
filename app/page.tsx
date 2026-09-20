import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import ClassroomDashboard from '@/components/classroom-dashboard'
import { redirect } from 'next/navigation'

export default async function Page() {
  const supabase = await createClient()

  // getSession() decodes the JWT locally (no network round-trip to the Auth
  // server), unlike getUser(). We can safely skip the extra server validation
  // here because every query below still goes through Supabase's own
  // JWT-signature check and RLS policies — an invalid/tampered session simply
  // gets empty/rejected results downstream, it can never read real data.
  // Skipping it here saves one full round-trip per page load, which matters
  // a lot given the Vercel<->Supabase cross-region latency on the free plan.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, username, role, class_id, class_settings(name)')
    .eq('id', session.user.id)
    .single()

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-bold text-red-600">Profil topilmadi</h1>
          <p className="mb-4 text-sm text-slate-500">
            Siz tizimga kirdingiz, lekin sizning profilingiz ma’lumotlar bazasida topilmadi yoki
            unga kirish taqiqlangan (RLS). <code>public.profiles</code> jadvalida shu foydalanuvchi
            uchun qator borligini tekshiring.
          </p>
          {profileError && (
            <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-left text-[11px] text-slate-500">
              {profileError.message}
            </pre>
          )}
          <form action={logout} className="mt-4">
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Chiqish
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Uzbekistan is UTC+5 year-round (no DST). Using raw UTC here would show
  // "yesterday" for a few hours every night around midnight in Tashkent.
  const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000
  const tashkentNow = new Date(Date.now() + TASHKENT_OFFSET_MS)
  const today = tashkentNow.toISOString().slice(0, 10)
  const monthAgo = new Date(tashkentNow.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Fire every remaining query at once instead of one-by-one — with the
  // Vercel<->Supabase network hop being the main cost, running them
  // concurrently instead of sequentially is the single biggest speed win
  // available without upgrading plans.
  const isKlasskom = profile.role === 'klasskom'
  const [
    { data: students },
    { data: klasskomList },
    { data: attendance },
    { data: duties },
    { data: collectionsData },
    { data: paymentsData },
  ] = await Promise.all([
    supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('class_id', profile.class_id)
      .order('first_name'),
    profile.role === 'teacher'
      ? supabase
          .from('profiles')
          .select('id, first_name, last_name, username')
          .eq('class_id', profile.class_id)
          .eq('role', 'klasskom')
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('attendance').select('student_id, date, status').gte('date', monthAgo),
    supabase
      .from('duty_schedules')
      .select('id, date, student_id, students(first_name, last_name)')
      .gte('date', monthAgo)
      .order('date'),
    // Collections/payments: only klasskom can see these — RLS blocks teachers
    // at the database level, so we skip the round-trip entirely for teachers.
    isKlasskom
      ? supabase.from('collections').select('id, title, expected_amount, created_at').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    isKlasskom
      ? supabase.from('payments').select('collection_id, student_id, paid_amount')
      : Promise.resolve({ data: [] as any[] }),
  ])

  return (
    <ClassroomDashboard
      profile={profile as any}
      students={students ?? []}
      klasskomList={klasskomList ?? []}
      attendance={attendance ?? []}
      duties={(duties ?? []) as any}
      collections={collectionsData ?? []}
      payments={paymentsData ?? []}
      today={today}
    />
  )
}
