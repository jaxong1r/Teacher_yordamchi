'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { usernameToEmail } from '@/lib/username'

export async function login(formData: FormData) {
  const username = String(formData.get('username') || '')
  const password = String(formData.get('password') || '')

  if (!username || !password) {
    return { error: 'Login va parolni kiriting' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  })

  if (error) {
    return { error: 'Login yoki parol noto‘g‘ri' }
  }

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
