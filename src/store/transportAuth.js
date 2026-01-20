import { create } from 'zustand'

const STORAGE_KEY = 'transport-auth'
const loadUser = () => {
  if (typeof window === 'undefined') return null
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored)
  } catch (error) {
    console.error('Failed to read auth storage', error)
    return null
  }
}

export const useTransportAuth = create((set) => ({
  transportUser: loadUser(),
  setTransportUser: (transportUser) => {
    set({ transportUser })
    if (transportUser) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(transportUser))
      } catch (error) {
        console.error('Failed to persist auth', error)
      }
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  },
  signOut: () => {
    set({ transportUser: null })
    sessionStorage.removeItem(STORAGE_KEY)
  }
}))
