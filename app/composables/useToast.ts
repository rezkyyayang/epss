export type ToastTone = 'success' | 'error' | 'info'
export interface Toast { id: number; tone: ToastTone; message: string }

// Success and info fade on their own; errors stay longer so there is time to read what failed.
const durations: Record<ToastTone, number> = { success: 4000, info: 5000, error: 8000 }
let nextId = 1

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function notify(message: string, tone: ToastTone = 'info') {
    if (!message || import.meta.server) return
    const id = nextId++
    // Three at most: an older toast gives way rather than piling up over the page.
    toasts.value = [...toasts.value.slice(-2), { id, tone, message }]
    window.setTimeout(() => dismiss(id), durations[tone])
  }

  return { toasts, notify, dismiss }
}

// A drop-in for a page's message ref: every non-empty assignment also pops a toast,
// even when the same text is set twice in a row (a plain watcher would miss that).
export function toastRef(tone: ToastTone) {
  const { notify } = useToast()
  return customRef<string>((track: () => void, trigger: () => void) => {
    let value = ''
    return {
      get() {
        track()
        return value
      },
      set(next: string) {
        value = next
        if (next) notify(next, tone)
        trigger()
      },
    }
  })
}
