'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowRight,
  Bell,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/actions/auth'
import { createKlasskomAccount, resetKlasskomPassword } from '@/app/actions/klasskom'
import { addStudent, removeStudent, setAttendance, toggleDutyRosterEntry, createCollection, deleteCollection, setPaymentAmount, renameClass, changeOwnPassword } from '@/app/actions/data'

type Role = 'teacher' | 'klasskom'
type Tab = 'home' | 'attendance' | 'students' | 'duties' | 'monitor' | 'payments' | 'settings'
type AttendanceStatus = 'present' | 'absent' | 'excused'

type StudentRow = { id: number; first_name: string; last_name: string }
type KlasskomRow = { id: string; first_name: string; last_name: string; username: string }
type AttendanceRow = { student_id: number; date: string; status: AttendanceStatus }
type DutyRow = { id: number; day_of_week: number; student_id: number }
type CollectionRow = { id: number; title: string; expected_amount: number; created_at: string }
type PaymentRow = { collection_id: number; student_id: number; paid_amount: number }
type Profile = {
  id: string
  first_name: string
  last_name: string
  username: string
  role: Role
  class_id: string
  class_settings: { name: string } | { name: string }[] | null
}

const WEEKDAYS = [
  { dow: 1, label: 'Dush' },
  { dow: 2, label: 'Sesh' },
  { dow: 3, label: 'Chor' },
  { dow: 4, label: 'Pay' },
  { dow: 5, label: 'Jum' },
  { dow: 6, label: 'Shan' },
]

const ACCENTS = [
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-emerald-100 text-emerald-700',
  'bg-indigo-100 text-indigo-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
]

function fullName(s: { first_name: string; last_name: string }) {
  return `${s.first_name} ${s.last_name}`
}
function initialsOf(s: { first_name: string; last_name: string }) {
  return `${s.first_name[0] ?? ''}${s.last_name[0] ?? ''}`.toUpperCase()
}
function accentOf(id: number) {
  return ACCENTS[id % ACCENTS.length]
}
function oneOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}
function formatMoney(value: number) {
  const grouped = Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${grouped} so‘m`
}
const UZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
]

function formatUzDate(dateStr: string, style: 'long' | 'short' = 'short') {
  const d = new Date(`${dateStr}T00:00:00`)
  const day = d.getDate()
  const month = d.getMonth()
  const year = d.getFullYear()
  if (style === 'long') return `${day} ${UZ_MONTHS[month]} ${year}`
  return `${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${year}`
}
function dowOf(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).getDay() // 0=Sunday, 1=Monday, ... 6=Saturday
}
function addDaysToDateStr(dateStr: string, delta: number) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}
const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { id: 'home', label: 'Bosh sahifa', icon: LayoutDashboard, roles: ['teacher', 'klasskom'] },
  { id: 'attendance', label: 'Yo‘qlama', icon: ClipboardCheck, roles: ['teacher', 'klasskom'] },
  { id: 'students', label: 'O‘quvchilar', icon: Users, roles: ['teacher', 'klasskom'] },
  { id: 'duties', label: 'Navbatchilar', icon: CalendarDays, roles: ['teacher', 'klasskom'] },
  { id: 'monitor', label: 'Klasskom', icon: ShieldCheck, roles: ['teacher'] },
  { id: 'payments', label: 'Pul yig‘imi', icon: WalletCards, roles: ['klasskom'] },
  { id: 'settings', label: 'Sozlamalar', icon: Settings, roles: ['teacher', 'klasskom'] },
]

export default function ClassroomDashboard({
  profile,
  students,
  klasskomList,
  attendance,
  duties,
  collections,
  payments,
  today,
}: {
  profile: Profile
  students: StudentRow[]
  klasskomList: KlasskomRow[]
  attendance: AttendanceRow[]
  duties: DutyRow[]
  collections: CollectionRow[]
  payments: PaymentRow[]
  today: string
}) {
  const router = useRouter()
  const role = profile.role
  const className = oneOrNull(profile.class_settings)?.name ?? 'Sinf'

  const [activeTab, setActiveTabState] = useState<Tab>('home')
  useEffect(() => {
    const saved = window.localStorage.getItem('sy-active-tab') as Tab | null
    if (saved && navItems.some(item => item.id === saved && item.roles.includes(profile.role))) {
      setActiveTabState(saved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function setActiveTab(tab: Tab) {
    setActiveTabState(tab)
    window.localStorage.setItem('sy-active-tab', tab)
  }
  const [mobileNav, setMobileNav] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [, startTransition] = useTransition()

  const visibleNav = navItems.filter(item => item.roles.includes(role))
  const filteredStudents = students.filter(s => fullName(s).toLowerCase().includes(search.toLowerCase()))

  const attendanceToday = useMemo(() => {
    const map: Record<number, AttendanceStatus> = {}
    for (const row of attendance) if (row.date === today) map[row.student_id] = row.status
    return map
  }, [attendance, today])

  const presentCount = Object.values(attendanceToday).filter(s => s === 'present').length
  const absentCount = Object.values(attendanceToday).filter(s => s === 'absent').length
  const excusedCount = Object.values(attendanceToday).filter(s => s === 'excused').length

  const todayDow = dowOf(today)
  const todaysDutyStudents = useMemo(() => {
    if (todayDow === 0) return [] // Sunday: no school, no duty
    const ids = new Set(duties.filter(d => d.day_of_week === todayDow).map(d => d.student_id))
    return students.filter(s => ids.has(s.id))
  }, [duties, students, todayDow])

  const [notifOpen, setNotifOpen] = useState(false)
  const hasNotifications = absentCount > 0 || (todayDow !== 0 && todaysDutyStudents.length === 0)

  const paymentStats = useMemo(() => {
    const total = payments.reduce((sum, p) => sum + p.paid_amount, 0)
    return { activeCollections: collections.length, total }
  }, [collections, payments])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  function refresh() {
    startTransition(() => router.refresh())
  }

  // Silently refresh when anyone else (same class) changes data — no toast,
  // just the data appearing. Debounced so a burst of changes triggers one
  // refresh instead of many.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const supabase = createClient()
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => refresh(), 350)
    }

    const channel = supabase
      .channel(`class-${profile.class_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duty_roster' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleRefresh)
      .subscribe()

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.class_id])

  async function handleAttendance(studentId: number, date: string, status: AttendanceStatus) {
    const result = await setAttendance(studentId, date, status)
    if (result?.error) showToast('Xatolik: saqlanmadi')
    else refresh()
  }

  async function handleMarkAll(date: string, status: AttendanceStatus) {
    await Promise.all(students.map(s => setAttendance(s.id, date, status)))
    showToast('Barchasi belgilandi')
    refresh()
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-slate-200 bg-white px-5 py-6 transition-transform lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-3 px-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#1958d1] text-white shadow-lg shadow-blue-200">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-tight">Sinf Yordamchisi</p>
            <p className="text-[11px] text-slate-400">{className}</p>
          </div>
        </div>

        <div className="mt-10">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Asosiy menyu</p>
          <nav className="space-y-1">
            {visibleNav.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileNav(false) }}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium transition ${activeTab === item.id ? 'bg-blue-50 text-[#1958d1]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                >
                  <Icon className={`size-[18px] ${activeTab === item.id ? 'text-[#1958d1]' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  {item.label}
                  {item.id === 'payments' && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Shaxsiy</span>}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="mt-auto rounded-2xl bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-[#1958d1]" />
            <span className="text-xs font-semibold">Bugungi maslahat</span>
          </div>
          <p className="text-xs leading-5 text-slate-500">Yo‘qlamani ertalabki darsdan oldin belgilang.</p>
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
          <div className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            {initialsOf(profile)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{fullName(profile)}</p>
            <p className="text-[11px] text-slate-400">{role === 'teacher' ? 'O‘qituvchi' : 'Klasskom'}</p>
          </div>
          <form action={logout}>
            <button type="submit" aria-label="Chiqish" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </aside>

      {mobileNav && (
        <button aria-label="Menyuni yopish" onClick={() => setMobileNav(false)} className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden" />
      )}

      <main className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur lg:px-10">
          <div className="flex items-center gap-3">
            <button aria-label="Menyu" onClick={() => setMobileNav(true)} className="rounded-lg p-2 hover:bg-slate-100 lg:hidden">
              <Menu className="size-5" />
            </button>
            <div>
              <p className="text-sm text-slate-400">{formatUzDate(today, 'long')}</p>
              <h1 className="text-lg font-bold tracking-tight">
                {activeTab === 'home' ? `Xush kelibsiz, ${profile.first_name}!` : navItems.find(i => i.id === activeTab)?.label}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                aria-label="Bildirishnomalar"
                onClick={() => setNotifOpen(v => !v)}
                className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100"
              >
                {hasNotifications && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500" />}
                <Bell className="size-[18px]" />
              </button>
              {notifOpen && (
                <>
                  <button aria-label="Yopish" className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Bugungi holat</p>
                    <div className="space-y-2 text-sm">
                      <p className="flex items-center gap-2">
                        <XCircle className="size-4 shrink-0 text-red-500" />
                        {absentCount > 0 ? `${absentCount} nafar o‘quvchi yo‘q` : 'Hammasi joyida — yo‘q bo‘lgan yo‘q'}
                      </p>
                      <p className="flex items-center gap-2">
                        <CalendarDays className="size-4 shrink-0 text-amber-500" />
                        {todayDow === 0
                          ? 'Bugun yakshanba — navbatchilik yo‘q'
                          : todaysDutyStudents.length > 0
                            ? `Bugungi navbatchi: ${todaysDutyStudents.map(fullName).join(', ')}`
                            : 'Bugunga navbatchi belgilanmagan'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="hidden size-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white sm:flex">
              {initialsOf(profile)}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1400px] px-5 py-7 lg:px-10 lg:py-9">
          {activeTab === 'home' && (
            <HomeView
              role={role}
              students={students}
              presentCount={presentCount}
              absentCount={absentCount}
              excusedCount={excusedCount}
              todaysDutyStudents={todaysDutyStudents}
              todayDow={todayDow}
              today={today}
              paymentStats={paymentStats}
              go={setActiveTab}
            />
          )}
          {activeTab === 'attendance' && (
            <AttendanceView
              students={students}
              attendance={attendance}
              today={today}
              update={handleAttendance}
              markAll={handleMarkAll}
            />
          )}
          {activeTab === 'students' && (
            <StudentsView
              students={filteredStudents}
              search={search}
              setSearch={setSearch}
              onAdd={async (firstName: string, lastName: string) => {
                const r = await addStudent(profile.class_id, firstName, lastName)
                showToast(r?.error ? 'Xatolik yuz berdi' : 'O‘quvchi qo‘shildi')
                refresh()
              }}
              onRemove={async (id: number) => {
                await removeStudent(id)
                showToast('O‘quvchi o‘chirildi')
                refresh()
              }}
            />
          )}
          {activeTab === 'duties' && (
            <DutiesView
              students={students}
              duties={duties}
              onToggle={async (dayOfWeek: number, studentId: number, onDuty: boolean) => {
                const r = await toggleDutyRosterEntry(profile.class_id, dayOfWeek, studentId, onDuty)
                if (r?.error) showToast('Xatolik yuz berdi')
                refresh()
              }}
            />
          )}
          {activeTab === 'monitor' && role === 'teacher' && (
            <MonitorView
              klasskomList={klasskomList}
              onCreate={async (formData: FormData) => {
                const r = await createKlasskomAccount(formData)
                if (r?.error) showToast(r.error)
                else { showToast('Klasskom akkaunti yaratildi'); refresh() }
                return r
              }}
              onResetPassword={async (formData: FormData) => {
                const r = await resetKlasskomPassword(formData)
                showToast(r?.error ? r.error : 'Parol yangilandi')
                return r
              }}
            />
          )}
          {activeTab === 'payments' && role === 'klasskom' && (
            <PaymentsView
              students={students}
              collections={collections}
              payments={payments}
              stats={paymentStats}
              onCreate={async (title: string, expected: number, studentIds: number[]) => {
                const r = await createCollection(profile.class_id, title, expected, studentIds)
                showToast(r?.error ? r.error : 'Yig‘im ochildi')
                refresh()
                return r
              }}
              onDelete={async (collectionId: number) => {
                await deleteCollection(collectionId)
                showToast('Yig‘im o‘chirildi')
                refresh()
              }}
              onChange={async (collectionId: number, studentId: number, paid: number) => {
                await setPaymentAmount(collectionId, studentId, paid)
                refresh()
              }}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsView
              role={role}
              className={className}
              profileName={fullName(profile)}
              onRenameClass={async (name: string) => {
                const r = await renameClass(profile.class_id, name)
                showToast(r?.error ? r.error : 'Sinf nomi yangilandi')
                refresh()
                return r
              }}
              onChangePassword={async (password: string) => {
                const r = await changeOwnPassword(password)
                showToast(r?.error ? r.error : 'Parol yangilandi')
                return r
              }}
            />
          )}
        </div>
      </main>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
          <CheckCircle2 className="size-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1958d1]">{eyebrow}</p>}
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
        {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

function StatCard({ label, value, helper, icon: Icon, tone = 'blue' }: { label: string; value: string; helper: string; icon: typeof Users; tone?: 'blue' | 'green' | 'red' | 'amber' }) {
  const tones = { blue: 'bg-blue-50 text-blue-700', green: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-700' }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <div className={`flex size-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="size-[19px]" />
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-400">{helper}</p>
    </div>
  )
}

function HomeView({ role, students, presentCount, absentCount, excusedCount, todaysDutyStudents, todayDow, today, paymentStats, go }: {
  role: Role
  students: StudentRow[]
  presentCount: number
  absentCount: number
  excusedCount: number
  todaysDutyStudents: StudentRow[]
  todayDow: number
  today: string
  paymentStats: { activeCollections: number; total: number }
  go: (tab: Tab) => void
}) {
  const attendanceRate = students.length ? Math.round((presentCount / students.length) * 100) : 0

  return (
    <>
      <SectionHeader
        eyebrow={role === 'teacher' ? 'Sinf rahbari paneli' : 'Klasskom paneli'}
        title={role === 'teacher' ? 'Sinfingiz bugun qanday?' : 'Bugungi ishlar'}
        description={`${students.length} nafar o‘quvchi`}
        action={<Button onClick={() => go('attendance')} className="h-10 rounded-xl bg-[#1958d1] px-4 text-sm hover:bg-blue-700"><ClipboardCheck className="mr-2 size-4" />Yo‘qlamani boshlash</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bugungi kelganlar" value={`${presentCount} / ${students.length}`} helper="Davomat holati" icon={CheckCircle2} tone="green" />
        <StatCard label="Bugungi kelmaganlar" value={`${absentCount}`} helper="E'tibor talab qiladi" icon={XCircle} tone="red" />
        <StatCard label="O‘quvchilar" value={`${students.length}`} helper="Sinf ro‘yxati" icon={Users} />
        <StatCard label="Bugungi navbatchilar" value={todayDow === 0 ? '—' : `${todaysDutyStudents.length}`} helper={todayDow === 0 ? 'Yakshanba — dars yo‘q' : formatUzDate(today)} icon={CalendarDays} tone="amber" />
        {role === 'klasskom' && (
          <StatCard label="Pul yig‘imi" value={`${paymentStats.activeCollections} ta yig‘im`} helper={`${formatMoney(paymentStats.total)} yig‘ildi`} icon={WalletCards} tone="amber" />
        )}
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold">Bugungi yo‘qlama</h3>
              <p className="mt-1 text-xs text-slate-400">{formatUzDate(today)}</p>
            </div>
            <button onClick={() => go('attendance')} className="text-xs font-semibold text-[#1958d1]">Batafsil <ArrowRight className="ml-1 inline size-3" /></button>
          </div>
          <div className="mt-7 flex items-center gap-8">
            <div className="relative flex size-32 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#1bb77a ${attendanceRate * 3.6}deg, #eef2f7 0)` }}>
              <div className="flex size-24 items-center justify-center rounded-full bg-white">
                <div className="text-center">
                  <p className="text-2xl font-bold">{attendanceRate}%</p>
                  <p className="text-[10px] text-slate-400">davomat</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-emerald-500" /><span className="text-slate-500">Bor</span><strong>{presentCount}</strong></div>
              <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-red-500" /><span className="text-slate-500">Yo‘q</span><strong>{absentCount}</strong></div>
              <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-amber-400" /><span className="text-slate-500">Sababli</span><strong>{excusedCount}</strong></div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold">Bugungi navbatchilar</h3>
              <p className="mt-1 text-xs text-slate-400">Haftalik navbatchilik jadvali</p>
            </div>
            <button onClick={() => go('duties')} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><MoreHorizontal className="size-5" /></button>
          </div>
          <div className="mt-5 space-y-3">
            {todayDow === 0 && <p className="text-sm text-slate-400">Bugun yakshanba — dars va navbatchilik yo‘q</p>}
            {todayDow !== 0 && todaysDutyStudents.length === 0 && <p className="text-sm text-slate-400">Bugun uchun navbatchi belgilanmagan</p>}
            {todaysDutyStudents.map(s => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">{initialsOf(s)}</div>
                <div className="flex-1"><p className="text-sm font-semibold">{fullName(s)}</p><p className="text-[11px] text-slate-400">Bugungi navbatchi</p></div>
                <Check className="size-4 text-emerald-500" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function StatusButton({ active, onClick, tone, label }: { active: boolean; onClick: () => void; tone: AttendanceStatus; label: string }) {
  const style = {
    present: active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400 hover:border-emerald-200 hover:text-emerald-600',
    absent: active ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-600',
    excused: active ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-400 hover:border-amber-200 hover:text-amber-600',
  }
  return <button onClick={onClick} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${style[tone]}`}>{label}</button>
}

function AttendanceView({ students, attendance, today, update, markAll }: {
  students: StudentRow[]
  attendance: AttendanceRow[]
  today: string
  update: (id: number, date: string, status: AttendanceStatus) => void
  markAll: (date: string, status: AttendanceStatus) => void
}) {
  const [selectedDate, setSelectedDate] = useState(today)
  const minDate = addDaysToDateStr(today, -31)

  const dayMap = useMemo(() => {
    const map: Record<number, AttendanceStatus> = {}
    for (const row of attendance) if (row.date === selectedDate) map[row.student_id] = row.status
    return map
  }, [attendance, selectedDate])

  const isToday = selectedDate === today

  return (
    <>
      <SectionHeader
        eyebrow="Davomat nazorati"
        title="Yo‘qlama"
        description={isToday ? `Bugun, ${formatUzDate(selectedDate, 'long')}` : formatUzDate(selectedDate, 'long')}
        action={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              min={minDate}
              max={today}
              onChange={e => setSelectedDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-400"
              style={{ colorScheme: 'light' }}
            />
            {!isToday && (
              <button onClick={() => setSelectedDate(today)} className="whitespace-nowrap rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-[#1958d1]">
                Bugunga qaytish
              </button>
            )}
          </div>
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
        <div>
          <p className="text-sm font-semibold text-blue-900">Tezkor belgilash</p>
          <p className="mt-0.5 text-xs text-blue-700/70">Barcha o‘quvchilar holatini bir bosishda belgilang</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => markAll(selectedDate, 'present')} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm">Hammasi bor</button>
          <button onClick={() => markAll(selectedDate, 'absent')} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm">Hammasi yo‘q</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1fr_240px] border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:grid">
          <span>O‘quvchi</span><span className="text-center">Holati</span>
        </div>
        {students.map(student => (
          <div key={student.id} className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3.5 last:border-0 sm:grid sm:grid-cols-[1fr_240px] sm:items-center sm:gap-0">
            <div className="flex items-center gap-3">
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${accentOf(student.id)}`}>{initialsOf(student)}</div>
              <div><p className="text-sm font-semibold">{fullName(student)}</p><p className="text-[11px] text-slate-400">ID: {String(student.id).padStart(3, '0')}</p></div>
            </div>
            <div className="flex justify-start gap-1.5 sm:justify-center">
              <StatusButton active={dayMap[student.id] === 'present'} onClick={() => update(student.id, selectedDate, 'present')} tone="present" label="Bor" />
              <StatusButton active={dayMap[student.id] === 'absent'} onClick={() => update(student.id, selectedDate, 'absent')} tone="absent" label="Yo‘q" />
              <StatusButton active={dayMap[student.id] === 'excused'} onClick={() => update(student.id, selectedDate, 'excused')} tone="excused" label="Sababli" />
            </div>
          </div>
        ))}
        {students.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-400">Hali o‘quvchi qo‘shilmagan</p>}
      </div>
    </>
  )
}

function StudentsView({ students, search, setSearch, onAdd, onRemove }: {
  students: StudentRow[]
  search: string
  setSearch: (v: string) => void
  onAdd: (firstName: string, lastName: string) => void
  onRemove: (id: number) => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [showForm, setShowForm] = useState(false)

  const sortedStudents = [...students].sort((a, b) => {
    const an = fullName(a).toLowerCase()
    const bn = fullName(b).toLowerCase()
    return an < bn ? -1 : an > bn ? 1 : 0
  })

  return (
    <>
      <SectionHeader
        eyebrow="Sinf ro‘yxati"
        title="O‘quvchilar"
        description="Ikkala rol uchun ham umumiy ro‘yxat"
        action={<Button onClick={() => setShowForm(v => !v)} className="h-10 rounded-xl bg-[#1958d1] hover:bg-blue-700"><Plus className="mr-2 size-4" />O‘quvchi qo‘shish</Button>}
      />
      {showForm && (
        <form
          onSubmit={e => { e.preventDefault(); if (!firstName || !lastName) return; onAdd(firstName, lastName); setFirstName(''); setLastName(''); setShowForm(false) }}
          className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <div><label className="mb-1.5 block text-xs font-semibold text-slate-500">Ism</label><input value={firstName} onChange={e => setFirstName(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-400" style={{ colorScheme: 'light' }} /></div>
          <div><label className="mb-1.5 block text-xs font-semibold text-slate-500">Familiya</label><input value={lastName} onChange={e => setLastName(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-400" style={{ colorScheme: 'light' }} /></div>
          <Button type="submit" className="h-10 rounded-xl bg-[#1958d1] hover:bg-blue-700">Qo‘shish</Button>
        </form>
      )}
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:w-[360px]">
        <Search className="size-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="O‘quvchini qidirish..." className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400" style={{ colorScheme: 'light' }} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[50px_1fr_80px] border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <span>№</span><span>O‘quvchi</span><span className="text-right">Amal</span>
        </div>
        {sortedStudents.map((student, index) => (
          <div key={student.id} className="grid grid-cols-[50px_1fr_80px] items-center border-b border-slate-100 px-5 py-3.5 last:border-0">
            <span className="text-sm font-semibold text-slate-400">{index + 1}</span>
            <div className="flex items-center gap-3">
              <div className={`flex size-9 items-center justify-center rounded-full text-xs font-bold ${accentOf(student.id)}`}>{initialsOf(student)}</div>
              <p className="text-sm font-semibold">{fullName(student)}</p>
            </div>
            <div className="flex justify-end"><button onClick={() => { if (confirm(`${fullName(student)} ni o‘chirishni tasdiqlaysizmi?`)) onRemove(student.id) }} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button></div>
          </div>
        ))}
      </div>
    </>
  )
}

function DutiesView({ students, duties, onToggle }: {
  students: StudentRow[]
  duties: DutyRow[]
  onToggle: (dayOfWeek: number, studentId: number, onDuty: boolean) => void
}) {
  const dutySet = useMemo(() => {
    const set = new Set<string>()
    for (const d of duties) set.add(`${d.day_of_week}-${d.student_id}`)
    return set
  }, [duties])

  return (
    <>
      <SectionHeader
        eyebrow="Tartib va mas’uliyat"
        title="Navbatchilar"
        description="Haftalik jadval — har hafta avtomatik takrorlanadi (yakshanba kuni navbatchilik yo‘q)"
      />
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="sticky left-0 z-10 bg-slate-50/70 px-5 py-3 text-left">O‘quvchi</th>
              {WEEKDAYS.map(w => (
                <th key={w.dow} className="px-2 py-3 text-center">{w.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map(student => (
              <tr key={student.id} className="border-b border-slate-100 last:border-0">
                <td className="sticky left-0 z-10 bg-white px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${accentOf(student.id)}`}>{initialsOf(student)}</div>
                    <span className="whitespace-nowrap text-sm font-semibold">{fullName(student)}</span>
                  </div>
                </td>
                {WEEKDAYS.map(w => {
                  const onDuty = dutySet.has(`${w.dow}-${student.id}`)
                  return (
                    <td key={w.dow} className="px-2 py-3 text-center">
                      <button
                        onClick={() => onToggle(w.dow, student.id, !onDuty)}
                        aria-pressed={onDuty}
                        aria-label={`${fullName(student)} — ${w.label}`}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${onDuty ? 'bg-[#1958d1]' : 'bg-slate-200'}`}
                      >
                        <span className={`inline-block size-4 transform rounded-full bg-white shadow transition ${onDuty ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400">Hali o‘quvchi qo‘shilmagan</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}


function MonitorView({ klasskomList, onCreate, onResetPassword }: {
  klasskomList: KlasskomRow[]
  onCreate: (formData: FormData) => Promise<{ error?: string; success?: boolean } | undefined>
  onResetPassword: (formData: FormData) => Promise<{ error?: string; success?: boolean } | undefined>
}) {
  const [error, setError] = useState('')
  const [resettingId, setResettingId] = useState<string | null>(null)

  return (
    <>
      <SectionHeader eyebrow="Hisob boshqaruvi" title="Klasskom" description="Klasskom akkauntini yarating va boshqaring" />

      {klasskomList.length === 0 ? (
        <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-bold">Klasskom akkaunti yaratish</h3>
          <p className="mt-1 text-sm text-slate-400">Ism, familiya, login va parol bering — o‘quvchi shu login/parol bilan kiradi.</p>
          <form
            action={async formData => { setError(''); const r = await onCreate(formData); if (r?.error) setError(r.error) }}
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            <div><label className="mb-1.5 block text-xs font-semibold text-slate-500">Ism</label><input name="firstName" required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-400" style={{ colorScheme: 'light' }} /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-slate-500">Familiya</label><input name="lastName" required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-400" style={{ colorScheme: 'light' }} /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-slate-500">Login</label><input name="username" required placeholder="masalan: jahongir01" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-400" style={{ colorScheme: 'light' }} /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-slate-500">Parol</label><input name="password" type="password" required minLength={6} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-400" style={{ colorScheme: 'light' }} /></div>
            {error && <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
            <Button type="submit" className="sm:col-span-2 h-11 rounded-xl bg-[#1958d1] hover:bg-blue-700">Akkaunt yaratish</Button>
          </form>
        </div>
      ) : (
        klasskomList.map(k => (
          <div key={k.id} className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-violet-100 text-lg font-bold text-violet-700">{initialsOf(k)}</div>
              <div className="flex-1"><p className="text-lg font-bold">{fullName(k)}</p><p className="mt-1 text-sm text-slate-400">Klasskom</p></div>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Faol</span>
            </div>
            <div className="grid gap-5 py-6 sm:grid-cols-2">
              <div><p className="mb-2 text-xs font-semibold text-slate-500">Login</p><div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">{k.username}</div></div>
            </div>
            <div className="border-t border-slate-100 pt-5">
              {resettingId === k.id ? (
                <form
                  action={async formData => { formData.set('klasskomId', k.id); const r = await onResetPassword(formData); if (!r?.error) setResettingId(null) }}
                  className="flex flex-wrap items-end gap-3"
                >
                  <div><label className="mb-1.5 block text-xs font-semibold text-slate-500">Yangi parol</label><input name="password" type="password" required minLength={6} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-400" style={{ colorScheme: 'light' }} /></div>
                  <Button type="submit" className="h-10 rounded-xl bg-[#1958d1] hover:bg-blue-700">Saqlash</Button>
                  <button type="button" onClick={() => setResettingId(null)} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-500">Bekor qilish</button>
                </form>
              ) : (
                <Button onClick={() => setResettingId(k.id)} variant="outline" className="rounded-xl"><ShieldCheck className="mr-2 size-4" />Parolni almashtirish</Button>
              )}
            </div>
          </div>
        ))
      )}
    </>
  )
}

function PaymentsView({ students, collections, payments, stats, onCreate, onDelete, onChange }: {
  students: StudentRow[]
  collections: CollectionRow[]
  payments: PaymentRow[]
  stats: { activeCollections: number; total: number }
  onCreate: (title: string, expected: number, studentIds: number[]) => Promise<{ error?: string; success?: boolean } | undefined>
  onDelete: (collectionId: number) => void
  onChange: (collectionId: number, studentId: number, paid: number) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [openCollectionId, setOpenCollectionId] = useState<number | null>(null)

  return (
    <>
      <SectionHeader
        eyebrow="Shaxsiy modul • faqat Klasskom"
        title="Pul yig‘imi"
        description="Har bir yig‘im uchun sabab, summa va kimlardan yig‘ilayotganini belgilang"
        action={<Button onClick={() => setShowForm(v => !v)} className="h-10 rounded-xl bg-[#1958d1] hover:bg-blue-700"><Plus className="mr-2 size-4" />Yangi yig‘im</Button>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Faol yig‘imlar" value={`${stats.activeCollections}`} helper="Ochiq turgan yig‘imlar soni" icon={WalletCards} tone="amber" />
        <StatCard label="Jami yig‘ilgan" value={formatMoney(stats.total)} helper="Barcha yig‘imlar bo‘yicha" icon={CircleDollarSign} />
      </div>

      {showForm && (
        <NewCollectionForm
          students={students}
          onCreate={async (title, expected, studentIds) => {
            const r = await onCreate(title, expected, studentIds)
            if (!r?.error) setShowForm(false)
            return r
          }}
        />
      )}

      {collections.length === 0 && !showForm && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-400">Hali birorta yig‘im ochilmagan. "Yangi yig‘im" tugmasini bosing.</p>
        </div>
      )}

      <div className="space-y-4">
        {collections.map(collection => {
          const collectionPayments = payments.filter(p => p.collection_id === collection.id)
          const collected = collectionPayments.reduce((sum, p) => sum + p.paid_amount, 0)
          const expectedTotal = collection.expected_amount * collectionPayments.length
          const paidCount = collectionPayments.filter(p => p.paid_amount >= collection.expected_amount && collection.expected_amount > 0).length
          const isOpen = openCollectionId === collection.id

          return (
            <div key={collection.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                onClick={() => setOpenCollectionId(isOpen ? null : collection.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{collection.title}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatMoney(collection.expected_amount)} / o‘quvchi • {collectionPayments.length} nafar • {formatUzDate(collection.created_at.slice(0, 10))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-700">{formatMoney(collected)}</p>
                    <p className="text-[11px] text-slate-400">{paidCount} / {collectionPayments.length} to‘lagan</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm(`"${collection.title}" yig‘imini o‘chirishni tasdiqlaysizmi?`)) onDelete(collection.id) }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100">
                  <div className="hidden grid-cols-[1fr_140px_140px_140px] border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:grid">
                    <span>O‘quvchi</span><span>To‘langan</span><span>Qolgan</span><span>Holat</span>
                  </div>
                  {collectionPayments.map(payment => {
                    const student = students.find(s => s.id === payment.student_id)
                    if (!student) return null
                    return (
                      <PaymentStudentRow
                        key={payment.student_id}
                        student={student}
                        payment={payment}
                        expectedAmount={collection.expected_amount}
                        onChange={paid => onChange(collection.id, payment.student_id, paid)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function NewCollectionForm({ students, onCreate }: {
  students: StudentRow[]
  onCreate: (title: string, expected: number, studentIds: number[]) => Promise<{ error?: string; success?: boolean } | undefined>
}) {
  const [title, setTitle] = useState('')
  const [expected, setExpected] = useState(20000)
  const [selected, setSelected] = useState<Set<number>>(new Set(students.map(s => s.id)))
  const [error, setError] = useState('')

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <form
      onSubmit={async e => {
        e.preventDefault()
        setError('')
        const r = await onCreate(title, expected, Array.from(selected))
        if (r?.error) setError(r.error)
      }}
      className="mb-6 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">Nima uchun (sabab)</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            placeholder="masalan: Yangi yil sovg‘asi uchun"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-400"
            style={{ colorScheme: 'light' }}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">Har bir o‘quvchidan qancha</label>
          <input
            type="number"
            min={0}
            value={expected}
            onChange={e => setExpected(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-400"
            style={{ colorScheme: 'light' }}
          />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-500">Kimlardan yig‘iladi</label>
          <div className="flex gap-2 text-[11px] font-semibold text-[#1958d1]">
            <button type="button" onClick={() => setSelected(new Set(students.map(s => s.id)))}>Hammasi</button>
            <button type="button" onClick={() => setSelected(new Set())}>Hech kim</button>
          </div>
        </div>
        <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
          {students.map(s => (
            <label key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="size-4 accent-[#1958d1]" />
              {fullName(s)}
            </label>
          ))}
          {students.length === 0 && <p className="text-sm text-slate-400">Hali o‘quvchi qo‘shilmagan</p>}
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}

      <Button type="submit" className="mt-4 h-10 rounded-xl bg-[#1958d1] hover:bg-blue-700">Yig‘imni ochish</Button>
    </form>
  )
}

function PaymentStudentRow({ student, payment, expectedAmount, onChange }: {
  student: StudentRow
  payment: PaymentRow
  expectedAmount: number
  onChange: (paid: number) => void
}) {
  const [addAmount, setAddAmount] = useState(5000)
  const remaining = Math.max(0, expectedAmount - payment.paid_amount)
  const status = remaining === 0 && expectedAmount > 0 ? 'To‘langan' : payment.paid_amount ? 'Qisman' : 'To‘lanmagan'

  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-3 last:border-0 sm:grid sm:grid-cols-[1fr_140px_140px_140px] sm:items-center">
      <div className="flex items-center gap-3">
        <div className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${accentOf(student.id)}`}>{initialsOf(student)}</div>
        <span className="text-sm font-semibold">{fullName(student)}</span>
      </div>
      <div className="flex items-center gap-3 text-xs sm:contents">
        <span className="font-semibold sm:font-semibold">{formatMoney(payment.paid_amount)} to‘langan</span>
        <span className="text-slate-500">{formatMoney(remaining)} qoldi</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${status === 'To‘langan' ? 'bg-emerald-50 text-emerald-700' : status === 'Qisman' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>{status}</span>
        <input
          type="number"
          min={0}
          value={addAmount}
          onChange={e => setAddAmount(Number(e.target.value))}
          className="w-16 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-950 outline-none focus:border-blue-400"
          style={{ colorScheme: 'light' }}
        />
        <button
          onClick={() => onChange(Math.min(expectedAmount, payment.paid_amount + addAmount))}
          className="shrink-0 rounded-lg border border-slate-200 px-1.5 py-1 text-[10px] font-semibold text-[#1958d1] hover:bg-blue-50"
        >
          +
        </button>
      </div>
    </div>
  )
}

function SettingsView({ role, className, profileName, onRenameClass, onChangePassword }: {
  role: Role
  className: string
  profileName: string
  onRenameClass: (name: string) => Promise<{ error?: string; success?: boolean } | undefined>
  onChangePassword: (password: string) => Promise<{ error?: string; success?: boolean } | undefined>
}) {
  const [classNameInput, setClassNameInput] = useState(className)
  const [password, setPassword] = useState('')
  const [classError, setClassError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)

  return (
    <>
      <SectionHeader eyebrow="Tizim sozlamalari" title="Sozlamalar" description="Sinf va hisob sozlamalarini boshqaring" />
      <div className="grid max-w-4xl gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#1958d1]"><Settings className="size-5" /></div>
          <h3 className="font-bold">Sinf ma’lumotlari</h3>
          {role === 'teacher' ? (
            <form
              onSubmit={async e => {
                e.preventDefault()
                setClassError('')
                const r = await onRenameClass(classNameInput)
                if (r?.error) setClassError(r.error)
              }}
              className="mt-4 flex flex-wrap items-center gap-2"
            >
              <input
                value={classNameInput}
                onChange={e => setClassNameInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-400"
                style={{ colorScheme: 'light' }}
              />
              <Button type="submit" className="h-10 rounded-xl bg-[#1958d1] hover:bg-blue-700">Saqlash</Button>
              {classError && <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{classError}</p>}
            </form>
          ) : (
            <p className="mt-1 text-sm text-slate-400">{className}</p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><UserRound className="size-5" /></div>
          <h3 className="font-bold">Profil</h3>
          <p className="mt-1 text-sm text-slate-400">{profileName} • {role === 'teacher' ? 'Sinf rahbari hisobi' : 'Klasskom shaxsiy hisobi'}</p>

          <form
            onSubmit={async e => {
              e.preventDefault()
              setPasswordError('')
              setPasswordSaved(false)
              const r = await onChangePassword(password)
              if (r?.error) setPasswordError(r.error)
              else { setPasswordSaved(true); setPassword('') }
            }}
            className="mt-5 border-t border-slate-100 pt-5"
          >
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><KeyRound className="size-3.5" />Yangi parol o‘rnatish</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                placeholder="Kamida 6 belgi"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-400"
                style={{ colorScheme: 'light' }}
              />
              <Button type="submit" className="h-10 rounded-xl bg-[#1958d1] text-white hover:bg-blue-700">O‘zgartirish</Button>
            </div>
            {passwordError && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{passwordError}</p>}
            {passwordSaved && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Parol yangilandi</p>}
          </form>
        </div>
      </div>
    </>
  )
}
