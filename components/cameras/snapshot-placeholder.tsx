import { Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SnapshotPlaceholderProps {
  className?: string
  label?: string
}

export function SnapshotPlaceholder({ className, label }: SnapshotPlaceholderProps) {
  return (
    <div className={cn('relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200', className)}>
      <div className="flex flex-col items-center gap-2 text-gray-400">
        <Camera className="h-12 w-12" strokeWidth={1} />
        {label && <p className="text-sm text-gray-400">{label}</p>}
      </div>
      {/* scan line effect */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent" />
    </div>
  )
}
