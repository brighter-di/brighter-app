export type ToastVariant = "error" | "info" | "success";

export interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  body?: string;
  href?: string;
  hrefLabel?: string;
  createdAt: number;
}

type Listener = (toasts: Toast[]) => void;

const listeners = new Set<Listener>();
let toasts: Toast[] = [];
let nextId = 1;

// Rate-limit duplicates: same title within 3s becomes a no-op so a failing polling
// query doesn't flood the viewport.
const DUP_WINDOW_MS = 3000;
const AUTO_DISMISS_MS = 6000;

function emit() {
  for (const l of listeners) l(toasts);
}

export function showToast(t: Omit<Toast, "id" | "createdAt">): number | null {
  const now = Date.now();
  if (toasts.some((x) => x.title === t.title && now - x.createdAt < DUP_WINDOW_MS)) {
    return null;
  }
  const id = nextId++;
  toasts = [...toasts, { ...t, id, createdAt: now }];
  emit();
  setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
  return id;
}

export function dismissToast(id: number): void {
  const next = toasts.filter((x) => x.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  l(toasts);
  return () => listeners.delete(l);
}
