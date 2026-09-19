import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClassroomDashboard from '@/components/classroom-dashboard'

export default async function Page() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, username, role, class_id, class_settings(name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

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
