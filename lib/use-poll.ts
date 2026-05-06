import { useEffect, useRef } from 'react'

export function usePoll(fn: () => void, intervalMs: number) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    const id = setInterval(() => fnRef.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}
