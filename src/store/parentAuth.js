import { create } from 'zustand'

const STORAGE_KEY = 'parent-auth'

const loadParent = () => {
    if (typeof window === 'undefined') return null
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY)
        if (!stored) return null
        return JSON.parse(stored)
    } catch (error) {
        console.error('Failed to read parent auth storage', error)
        return null
    }
}

export const useParentAuth = create((set) => ({
    parent: loadParent(), // Stores the student object but logged in as parent
    setParent: (parent) => {
        set({ parent })
        if (parent) {
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parent))
            } catch (error) {
                console.error('Failed to persist parent auth', error)
            }
        } else {
            sessionStorage.removeItem(STORAGE_KEY)
        }
    },
    signOut: () => {
        set({ parent: null })
        sessionStorage.removeItem(STORAGE_KEY)
    }
}))
