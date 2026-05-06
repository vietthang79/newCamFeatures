'use client'
import { Loader2 } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean
  loadingText?: string
}

export function LoadingButton({ loading, loadingText, children, disabled, className, ...props }: LoadingButtonProps) {
  return (
    <Button disabled={loading || disabled} className={cn(className)} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading && loadingText ? loadingText : children}
    </Button>
  )
}
