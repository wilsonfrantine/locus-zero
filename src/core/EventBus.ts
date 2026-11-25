import type { AppEventMap } from './types';

export type EventHandler<TPayload> = (payload: TPayload) => void;

/**
 * Pub/Sub tipado e leve para desacoplar Engines, InteractionManager e UI.
 */
export class EventBus<
  TEvents extends { [K in keyof TEvents]: unknown } = AppEventMap,
> {
  private readonly listeners = new Map<keyof TEvents, Set<EventHandler<unknown>>>();

  on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler as EventHandler<unknown>);
    return () => this.off(event, handler);
  }

  once<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.delete(handler as EventHandler<unknown>);
    if (handlers.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    // Copia defensiva permite remoção durante a iteração (ex.: once)
    for (const handler of [...handlers]) {
      (handler as EventHandler<TEvents[K]>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
