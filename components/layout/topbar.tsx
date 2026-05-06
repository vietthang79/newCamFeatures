'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Building2, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useData } from '@/lib/data-store'
import { cn } from '@/lib/utils'

const CRUMB_MAP: Record<string, string> = {
  cameras: 'Cameras',
  new: 'New',
  overview: 'Overview',
  configuration: 'Configuration',
  zones: 'Zones',
  health: 'Health',
  admin: 'Admin',
  companies: 'Companies',
  users: 'Users',
}

export function Topbar() {
  const pathname = usePathname()
  const { session, selectedCompanyId, setSelectedCompanyId } = useAuth()
  const { companies } = useData()
  const [open, setOpen] = useState(false)

  const segments = pathname.split('/').filter(Boolean)
  const crumbs = segments.map((seg, i) => ({
    label: CRUMB_MAP[seg] ?? seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }))

  const selectedCompany = companies.find(c => c.id === selectedCompanyId)

  return (
    <header className="flex h-12 items-center justify-between border-b border-gray-200 bg-white px-5">
      <nav className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-300">/</span>}
            {crumb.isLast ? (
              <span className="text-gray-800 font-medium">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-gray-500 hover:text-gray-800 transition-colors">{crumb.label}</Link>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        {/* Company switcher for vendor_admin in topbar */}
        {session?.role === 'vendor_admin' && (
          <div className="relative">
            <button
              onClick={() => setOpen(v => !v)}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 hover:border-gray-300 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <Building2 className="h-3 w-3 text-pri-text" />
              <span className="max-w-[120px] truncate">{selectedCompany?.name ?? 'No company'}</span>
              <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
            </button>

            {open && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <p className="px-3 py-1.5 text-xs font-medium text-gray-400">Switch company</p>
                  {companies.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCompanyId(c.id); setOpen(false); }}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer',
                        selectedCompanyId === c.id
                          ? 'bg-primary-light text-pri-text'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <span>{c.name}</span>
                      {c.status === 'inactive' && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500">inactive</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <button className="relative cursor-pointer text-gray-500 hover:text-gray-700 transition-colors" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">3</span>
        </button>
      </div>
    </header>
  )
}
