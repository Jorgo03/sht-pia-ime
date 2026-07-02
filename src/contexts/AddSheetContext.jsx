import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const AddSheetContext = createContext(null)

export function AddSheetProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [miniForm, setMiniForm] = useState(null)

  const openSheet = useCallback(() => setOpen(true), [])
  const closeSheet = useCallback(() => { setOpen(false); setMiniForm(null) }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <AddSheetContext.Provider value={{ open, openSheet, closeSheet, toast, setToast, miniForm, setMiniForm }}>
      {children}
    </AddSheetContext.Provider>
  )
}

export function useAddSheet() {
  const ctx = useContext(AddSheetContext)
  if (!ctx) throw new Error('useAddSheet must be used within AddSheetProvider')
  return ctx
}
