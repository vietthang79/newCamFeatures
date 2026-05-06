import { cn } from '@/lib/utils'

type Status = 'online' | 'warning' | 'offline' | 'pending'

const STATUS_CONFIG: Record<Status, { dot: string; label: string; text: string; bg: string; border: string }> = {
  online:  { dot: 'bg-green-500',  label: 'Online',  text: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200' },
  warning: { dot: 'bg-yellow-500', label: 'Warning', text: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200' },
  offline: { dot: 'bg-red-500',    label: 'Offline', text: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200' },
  pending: { dot: 'bg-gray-400',   label: 'Pending', text: 'text-gray-600',   bg: 'bg-gray-100',   border: 'border-gray-200' },
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', cfg.bg, cfg.border, cfg.text, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot, status === 'online' && 'animate-pulse')} />
      {cfg.label}
    </span>
  )
}
