'use client'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CanvasZone, ZoneType } from './zone-editor'

export const ZONE_LABELS: Record<ZoneType, string> = {
  parking_zone: 'Parking Geo-zone',
  entrance_zone: 'Entrance Geo-zone',
  no_smoking_zone: 'No Smoking Geo-zone',
}

const ZONE_VARIANTS: Record<ZoneType, 'default' | 'success' | 'destructive'> = {
  parking_zone: 'default',
  entrance_zone: 'success',
  no_smoking_zone: 'destructive',
}

interface ZoneListProps {
  zones: CanvasZone[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

export function ZoneList({ zones, selectedId, onSelect, onDelete }: ZoneListProps) {
  if (zones.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">
        No geo-zones drawn yet. Use "Draw Geo-zone" to start.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {zones.map((zone, i) => (
        <div
          key={zone.id}
          onClick={() => onSelect(zone.id)}
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors',
            selectedId === zone.id
              ? 'border-primary/50 bg-primary-light'
              : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
          )}
        >
          <Badge variant={ZONE_VARIANTS[zone.type]} className="text-xs">
            {ZONE_LABELS[zone.type]}
          </Badge>
          <span className="flex-1 text-sm text-gray-700">Geo-zone {i + 1}</span>
          <span className="text-xs text-gray-400">{zone.points.length} pts</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-400 hover:text-red-500"
            onClick={(e) => { e.stopPropagation(); onDelete(zone.id) }}
            aria-label="Delete zone"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  )
}
