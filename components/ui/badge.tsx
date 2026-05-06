import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/30 bg-primary-light text-pri-text',
        secondary: 'border-gray-200 bg-gray-100 text-gray-700',
        destructive: 'border-red-500/30 bg-red-500/20 text-red-600',
        outline: 'border-gray-300 text-gray-700',
        success: 'border-green-500/30 bg-green-500/20 text-green-700',
        warning: 'border-yellow-500/30 bg-yellow-500/20 text-yellow-700',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
