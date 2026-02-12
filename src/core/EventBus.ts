type Listener = (...args: any[]) => void;

/** Lightweight pub/sub event bus */
export class EventBus {
  private listeners: Map<string, Set<Listener>> = new Map();

  on(event: string, fn: Listener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  off(event: string, fn: Listener): void {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(fn => fn(...args));
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** Singleton event bus for global game events */
export const eventBus = new EventBus();
