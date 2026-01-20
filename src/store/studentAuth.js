import { create } from 'zustand'

const STORAGE_KEY = 'student-auth'

const loadStudent = () => {
  if (typeof window === 'undefined') return null
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored)
  } catch (error) {
    console.error('Failed to read student auth storage', error)
    return null
  }
}

export const useStudentAuth = create((set) => ({
  student: loadStudent(),
  setStudent: (student) => {
    set({ student })
    if (student) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(student))
      } catch (error) {
        console.error('Failed to persist student auth', error)
      }
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  },
  signOut: () => {
    set({ student: null })
    sessionStorage.removeItem(STORAGE_KEY)
  }
}))
