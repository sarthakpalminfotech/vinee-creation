import { useEffect, useState } from 'react'
import { getVersion, subscribe } from '../db/client'

/** Returns a number that changes after every successful database write — add it to a load effect's deps to auto-refresh. */
export function useDbVersion() {
  const [v, setV] = useState(getVersion())
  useEffect(() => subscribe(setV), [])
  return v
}
