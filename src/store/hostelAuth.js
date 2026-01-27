import { create } from 'zustand'

const STORAGE_KEY = 'hostel-auth'

const loadUser = () => {
  if (typeof window === 'undefined') return null
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored)
  } catch (error) {
    console.error('Failed to read hostel auth storage', error)
    return null
  }
}

export const useHostelAuth = create((set) => ({
  hostelUser: loadUser(),
  setHostelUser: (hostelUser) => {
    set({ hostelUser })
    if (hostelUser) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(hostelUser))
      } catch (error) {
        console.error('Failed to persist hostel auth', error)
      }
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  },
  signOut: () => {
    set({ hostelUser: null })
    sessionStorage.removeItem(STORAGE_KEY)
  }
}))
