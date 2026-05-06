'use client'
import { useState } from 'react'
import { Clipboard, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface CopyButtonProps {
  value: string
}

export function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleCopy} aria-label="Copy to clipboard" className="h-8 w-8 shrink-0">
      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Clipboard className="h-4 w-4" />}
    </Button>
  )
}
