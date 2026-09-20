import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import ClassroomDashboard from '@/components/classroom-dashboard'
import { redirect } from 'next/navigation'

export default async function Page() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, username, role, class_id, class_settings(name)')
    .eq('id', user.id)
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

  const [{ data: students }, { data: klasskomList }] = await Promise.all([
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
  ])

  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: attendance } = await supabase
    .from('attendance')
    .select('student_id, date, status')
    .gte('date', monthAgo)

  const { data: duties } = await supabase
    .from('duty_schedules')
    .select('id, date, student_id, students(first_name, last_name)')
    .gte('date', monthAgo)
    .order('date')

  // Payments query only succeeds for klasskom — RLS blocks teachers at the DB level.
  const { data: payments } =
    profile.role === 'klasskom'
      ? await supabase.from('payments').select('student_id, period, expected_amount, paid_amount')
      : { data: [] }

  return (
    <ClassroomDashboard
      profile={profile as any}
      students={students ?? []}
      klasskomList={klasskomList ?? []}
      attendance={attendance ?? []}
      duties={(duties ?? []) as any}
      payments={payments ?? []}
      today={today}
    />
  )
}
