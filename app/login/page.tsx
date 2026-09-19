'use client'

import { useState, useTransition } from 'react'
import { GraduationCap, Loader2 } from 'lucide-react'
import { login } from '@/app/actions/auth'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError('')
    startTransition(async () => {
      const result = await login(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[#1958d1] text-white shadow-lg shadow-blue-200">
            <GraduationCap className="size-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Sinf Yordamchisi</h1>
          <p className="mt-1 text-sm text-slate-400">Tizimga kirish uchun login va parolni kiriting</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Login</label>
            <input
              name="username"
              required
              autoComplete="username"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              placeholder="login"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Parol</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1958d1] text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Kirish
          </button>
        </form>
      </div>
    </div>
  )
}
