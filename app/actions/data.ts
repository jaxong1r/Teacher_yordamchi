'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function currentUserOrThrow() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Tizimga kirilmagan')
  return { supabase, user }
}

// ---- Students ----
export async function addStudent(classId: string, firstName: string, lastName: string) {
  const { supabase } = await currentUserOrThrow()
  const { error } = await supabase
    .from('students')
    .insert({ class_id: classId, first_name: firstName, last_name: lastName })
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function removeStudent(studentId: number) {
  const { supabase } = await currentUserOrThrow()
  const { error } = await supabase.from('students').delete().eq('id', studentId)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

// ---- Attendance (kept for the last 31 days by a scheduled cleanup, see SETUP.md) ----
export async function setAttendance(
  studentId: number,
  date: string,
  status: 'present' | 'absent' | 'excused'
) {
  const { supabase, user } = await currentUserOrThrow()
  const { error } = await supabase.from('attendance').upsert(
    { student_id: studentId, date, status, updated_by: user.id },
    { onConflict: 'student_id,date' }
  )
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

// ---- Duty roster ----
export async function addDuty(studentId: number, date: string) {
  const { supabase, user } = await currentUserOrThrow()
  const { error } = await supabase
    .from('duty_schedules')
    .insert({ student_id: studentId, date, created_by: user.id })
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function removeDuty(dutyId: number) {
  const { supabase } = await currentUserOrThrow()
  const { error } = await supabase.from('duty_schedules').delete().eq('id', dutyId)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

// ---- Money collections (klasskom-only; enforced by RLS, so a teacher call fails at the DB level) ----
export async function createCollection(
  classId: string,
  title: string,
  expectedAmount: number,
  studentIds: number[]
) {
  const { supabase, user } = await currentUserOrThrow()
  if (!title.trim()) return { error: 'Sarlavha kiriting' }
  if (studentIds.length === 0) return { error: 'Kamida bitta o‘quvchi tanlang' }

  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .insert({ class_id: classId, title: title.trim(), expected_amount: expectedAmount, created_by: user.id })
    .select('id')
    .single()

  if (collectionError || !collection) return { error: collectionError?.message || 'Yig‘im yaratilmadi' }

  const { error: paymentsError } = await supabase
    .from('payments')
    .insert(studentIds.map(studentId => ({ collection_id: collection.id, student_id: studentId, paid_amount: 0 })))

  if (paymentsError) {
    await supabase.from('collections').delete().eq('id', collection.id)
    return { error: paymentsError.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function deleteCollection(collectionId: number) {
  const { supabase } = await currentUserOrThrow()
  const { error } = await supabase.from('collections').delete().eq('id', collectionId)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function setPaymentAmount(collectionId: number, studentId: number, paidAmount: number) {
  const { supabase } = await currentUserOrThrow()
  const { error } = await supabase.from('payments').upsert(
    { collection_id: collectionId, student_id: studentId, paid_amount: paidAmount },
    { onConflict: 'collection_id,student_id' }
  )
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}
