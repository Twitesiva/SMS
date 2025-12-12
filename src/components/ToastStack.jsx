import { memo, useEffect } from 'react'
import { useUiStore } from '../store/ui.js'

const typeToAccent = {
  success: 'toast-card--success',
  danger: 'toast-card--danger',
  error: 'toast-card--danger',
  warning: 'toast-card--warning',
  info: 'toast-card--info'
}

const ToastItem = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  const accentClass = typeToAccent[toast.type] || typeToAccent.info

  const actions = Array.isArray(toast.actions) ? toast.actions : []

  return (
    <div className={`toast-card ${accentClass}`} role="status" aria-live="assertive">
      <div className="toast-card__body">
        {toast.title ? <div className="toast-card__title">{toast.title}</div> : null}
        <div className="toast-card__message">{toast.message}</div>
        {actions.length ? (
          <div className="toast-card__actions">
            {actions.map((action, index) => (
              <button
                key={`${toast.id}-action-${index}`}
                type="button"
                className={`toast-card__action toast-card__action--${action.variant || 'neutral'}`}
                onClick={() => {
                  try {
                    action.onClick && action.onClick()
                  } catch (err) {
                    console.error('Toast action error', err)
                  }
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="toast-card__close"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
      >
        &times;
      </button>
    </div>
  )
}

const ToastStack = () => {
  const toasts = useUiStore(state => state.toasts)
  const dismissToast = useUiStore(state => state.dismissToast)

  if (!toasts.length) return null

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  )
}

export default memo(ToastStack)
