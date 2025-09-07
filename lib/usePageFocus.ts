import { useEffect, useRef } from 'react'

export function usePageFocus(callback: () => void) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        callbackRef.current()
      }
    }

    const handleFocus = () => {
      callbackRef.current()
    }

    const handlePageShow = () => {
      callbackRef.current()
    }

    // Listen to visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Listen to window focus
    window.addEventListener('focus', handleFocus)
    
    // Listen to page show (for back/forward navigation)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [])
}
