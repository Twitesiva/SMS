import { create } from 'zustand'

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

export const useUiStore = create((set) => ({
  pendingRequests: 0,
  toasts: [],
  startRequest: () => set((state) => ({ pendingRequests: state.pendingRequests + 1 })),
  finishRequest: () => set((state) => ({ pendingRequests: Math.max(0, state.pendingRequests - 1) })),
  pushToast: (toast) => set((state) => {
    const next = {
      id: toast.id || generateId(),
      type: toast.type || 'info',
      title: toast.title || '',
      message: toast.message || '',
      duration: typeof toast.duration === 'number' ? toast.duration : 5000,
      actions: toast.actions || [],
    }
    return { toasts: [...state.toasts, next] }
  }),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter(toast => toast.id !== id) })),
  clearToasts: () => set({ toasts: [] })
}))

export const trackPromise = async (promise) => {
  const { startRequest, finishRequest } = useUiStore.getState()
  startRequest()
  try {
    return await promise
  } finally {
    finishRequest()
  }
}

export const showToast = (message, options = {}) => {
  const { pushToast } = useUiStore.getState()
  pushToast({ message, ...options })
}

export const confirmToast = ({
  message,
  title = 'Confirm action',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  duration = 0,
  type = 'warning',
} = {}) => {
  return new Promise((resolve) => {
    const { pushToast, dismissToast } = useUiStore.getState()
    const id = generateId()
    const handleClose = () => dismissToast(id)
    const actions = [
      {
        label: cancelLabel,
        variant: 'outline',
        onClick: () => {
          resolve(false)
          handleClose()
        },
      },
      {
        label: confirmLabel,
        variant: 'danger',
        onClick: () => {
          resolve(true)
          handleClose()
        },
      },
    ]
    pushToast({
      id,
      message,
      title,
      type,
      duration,
      actions,
    })
  })
}
