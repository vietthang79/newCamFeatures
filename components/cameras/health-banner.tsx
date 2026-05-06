'use client'
import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface HealthBannerProps {
  lastFrameAt: Date | null
}

export function HealthBanner({ lastFrameAt }: HealthBannerProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!lastFrameAt) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-600">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">Not receiving frames — camera has never sent data.</span>
      </div>
    )
  }

  if (!mounted) return null

  const age = Date.now() - lastFrameAt.getTime()
  if (age <= 300_000) return null
  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-600">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">Not receiving frames — last frame was more than 5 minutes ago.</span>
    </div>
  )
}
