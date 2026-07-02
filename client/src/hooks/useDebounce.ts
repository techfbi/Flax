import { useState, useEffect } from 'react'

/*
  Debounces a value by the given delay in milliseconds.
  Used for search inputs to avoid firing on every keystroke.
*/
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}