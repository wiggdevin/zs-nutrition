import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  message: string
  createdAt: number
}

export const MAX_VISIBLE_TOASTS = 5

interface ToastStore {
  toasts: Toast[]
  addToast: (type: ToastType, message: string) => string
  removeToast: (id: string) => void
  clearAll: () => void
}

let toastCounter = 0

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = `toast-${++toastCounter}-${Date.now()}`
    const toast: Toast = { id, type, message, createdAt: Date.now() }
    set((state) => {
      const newToasts = [...state.toasts, toast]
      // Automatically remove oldest toasts if limit exceeded
      if (newToasts.length > MAX_VISIBLE_TOASTS) {
        return { toasts: newToasts.slice(newToasts.length - MAX_VISIBLE_TOASTS) }
      }
      return { toasts: newToasts }
    })
    return id
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
  clearAll: () => set({ toasts: [] }),
}))

// Convenience functions for use outside of React components
export const toast = {
  success: (message: string) => useToastStore.getState().addToast('success', message),
  error: (message: string) => useToastStore.getState().addToast('error', message),
  info: (message: string) => useToastStore.getState().addToast('info', message),
  warning: (message: string) => useToastStore.getState().addToast('warning', message),
}
