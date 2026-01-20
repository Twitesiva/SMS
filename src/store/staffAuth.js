import { create } from 'zustand'

const STORAGE_KEY = 'staff-auth'

const loadStaff = () => {
    if (typeof window === 'undefined') return null
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY)
        if (!stored) return null
        return JSON.parse(stored)
    } catch (error) {
        console.error('Failed to read staff auth storage', error)
        return null
    }
}

export const useStaffAuth = create((set) => ({
    staff: loadStaff(),
    setStaff: (staff) => {
        set({ staff })
        if (staff) {
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(staff))
            } catch (error) {
                console.error('Failed to persist staff auth', error)
            }
        } else {
            sessionStorage.removeItem(STORAGE_KEY)
        }
    },
    signOut: () => {
        set({ staff: null })
        sessionStorage.removeItem(STORAGE_KEY)
    }
}))
