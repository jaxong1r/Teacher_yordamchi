'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { usernameToEmail, isValidUsername } from '@/lib/username'
import { revalidatePath } from 'next/cache'

async function requireTeacher() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Tizimga kirilmagan')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, class_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') {
    throw new Error('Faqat sinf rahbari bu amalni bajara oladi')
  }

  return { supabase, profile }
}

export async function createKlasskomAccount(formData: FormData) {
  const firstName = String(formData.get('firstName') || '').trim()
  const lastName = String(formData.get('lastName') || '').trim()
  const username = String(formData.get('username') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')

  if (!firstName || !lastName) return { error: 'Ism va familiyani kiriting' }
  if (!isValidUsername(username)) {
    return { error: 'Login 3-20 belgidan, faqat lotin harflar/raqam/pastki chiziq' }
  }
  if (password.length < 6) return { error: 'Parol kamida 6 belgidan iborat bo‘lsin' }

  const { profile } = await requireTeacher()
  const admin = createAdminClient()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return { error: createError?.message?.includes('already') ? 'Bu login band' : 'Akkaunt yaratilmadi' }
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    first_name: firstName,
    last_name: lastName,
    username,
    role: 'klasskom',
    class_id: profile.class_id,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: 'Profil yaratilmadi, qaytadan urinib ko‘ring' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function resetKlasskomPassword(formData: FormData) {
  const klasskomId = String(formData.get('klasskomId') || '')
  const password = String(formData.get('password') || '')
  if (password.length < 6) return { error: 'Parol kamida 6 belgidan iborat bo‘lsin' }

  await requireTeacher()
  const admin = createAdminClient()

  const { error } = await admin.auth.admin.updateUserById(klasskomId, { password })
  if (error) return { error: 'Parol yangilanmadi' }

  revalidatePath('/')
  return { success: true }
}
