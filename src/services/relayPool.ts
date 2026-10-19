import { Event, Filter, SimplePool } from "nostr-tools";

const pool = new SimplePool();

/**
 * Relays a preview falls back to when the reference carries no hints (a bare
 * `note1` has none). Read lazily so a value from `.env` is picked up even
 * though dotenv.config() runs after this module is evaluated.
 */
const getDefaultRelays = () =>
  (process.env.NOSTR_RELAYS ??
    "wss://relay.formstr.app,wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol")
    .split(",")
    .map((relay) => relay.trim())
    .filter(Boolean);

const getTimeoutMs = () => Number(process.env.NOSTR_FETCH_TIMEOUT_MS || 10000);

/**
 * Subscribe to the given relays and resolve with the first matching event.
 * Resolves `null` once the timeout elapses so an unreachable relay can never
 * hang the request. Read-only — this pool is never a publish target.
 */
export const fetchEvent = (
  relays: string[] | undefined,
  filter: Filter
): Promise<Event | null> => {
  const targets = relays && relays.length > 0 ? relays : getDefaultRelays();
  if (targets.length === 0) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;

    const settle = (event: Event | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub.close();
      resolve(event);
    };

    const sub = pool.subscribeMany(targets, filter, {
      onevent: (event: Event) => settle(event),
    });

    const timer = setTimeout(() => settle(null), getTimeoutMs());
  });
};
