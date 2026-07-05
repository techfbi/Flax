import { useState } from 'react'

/*
  useSessionState: like useState but persisted to sessionStorage.
  On refresh, the value is restored from the session.
  When the tab closes, sessionStorage is cleared automatically by the browser.
  Safe for UI-only state (active tab, sidebar state, etc.).
  Never use for sensitive data.
*/
export const useSessionState = <T>(
  key: string,
  defaultValue: T
): [T, (val: T) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key)
      if (stored !== null) return JSON.parse(stored) as T
    } catch {
      /* Parse failure: fall through to default */
    }
    return defaultValue
  })

  const setAndStore = (val: T) => {
    setValue(val)
    try {
      sessionStorage.setItem(key, JSON.stringify(val))
    } catch {
      /* Storage full or unavailable: state still works in memory */
    }
  }

  return [value, setAndStore]
}