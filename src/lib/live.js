import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getVersion, subscribe } from '../db/client'

/** Returns a number that changes after every successful database write — add it to a load effect's deps to auto-refresh. */
export function useDbVersion() {
  const [v, setV] = useState(getVersion())
  useEffect(() => subscribe(setV), [])
  return v
}

/** Back target of a details screen: where it was opened from (navigate state `from`), else `fallback`. */
export function useBackTo(fallback) {
  const navigate = useNavigate()
  const location = useLocation()
  return () => navigate(location.state?.from || fallback)
}
