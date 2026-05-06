'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Camera, Building2, Users, LogOut, ChevronRight, Shield } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useData } from '@/lib/data-store'
import { cn } from '@/lib/utils'

const OPERATOR_NAV = [
  { href: '/cameras', label: 'Cameras', icon: Camera },
]

const ADMIN_NAV = [
  { href: '/cameras', label: 'Cameras', icon: Camera },
  { href: '/admin/companies', label: 'Companies', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/health', label: 'System Health', icon: Shield },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { session, logout, selectedCompanyId, setSelectedCompanyId, effectiveCompanyId } = useAuth()
  const { companies } = useData()

  if (!session) return null

  const isAdmin = session.role === 'vendor_admin'
  const navItems = isAdmin ? ADMIN_NAV : OPERATOR_NAV

  const displayCompany = isAdmin
    ? companies.find(c => c.id === effectiveCompanyId)?.name ?? 'Select company'
    : companies.find(c => c.id === session.companyId)?.name ?? 'Unknown'

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2.5 border-b border-gray-200 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Camera className="h-4 w-4 text-black" />
        </div>
        <span className="text-base font-semibold text-gray-900">Intelli-Park</span>
      </div>

      {/* Company context for vendor_admin */}
      {isAdmin && (
        <div className="border-b border-gray-200 px-3 py-2">
          <p className="mb-1 px-1 text-xs text-gray-400">Viewing company</p>
          <div className="space-y-0.5">
            {companies.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCompanyId(c.id)}
                className={cn(
                  'w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors cursor-pointer',
                  selectedCompanyId === c.id
                    ? 'bg-primary-light text-pri-text'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                )}
              >
                <span className="flex items-center justify-between">
                  {c.name}
                  {selectedCompanyId === c.id && <ChevronRight className="h-3 w-3" />}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                active ? 'bg-primary-light text-pri-text' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {active && <ChevronRight className="ml-auto h-3 w-3" />}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-black">
            {session.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-gray-800">{session.name}</p>
            <p className="truncate text-xs text-gray-500">{displayCompany}</p>
          </div>
          <button onClick={handleLogout} className="cursor-pointer text-gray-400 hover:text-gray-700 transition-colors" aria-label="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
