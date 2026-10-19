import { Event } from "nostr-tools";
import { wrapWithCache } from "./cache";
import { fetchEvent } from "./relayPool";

interface ResolveByIdInput {
  id: string;
  relays?: string[];
  /** The bech32 identifier the caller used, so distinct encodings of the same
   *  event share one cache slot. */
  encoded: string;
}

/**
 * Resolve a `nevent`/`note` reference by id. This is what covers pollerama's
 * regular events — short-text notes (posts/replies, kind 1) and polls
 * (kind 1068) — which are shared as `nevent`, not `naddr`. Relay hints from the
 * nevent are used when present; otherwise `fetchEvent` falls back to the
 * default relay set.
 */
const _resolveById = async ({
  id,
  relays,
}: ResolveByIdInput): Promise<Event | null> => {
  const filter = { ids: [id], limit: 1 };
  console.log(`fetching event by id`, JSON.stringify(filter));
  return fetchEvent(relays, filter);
};

export const resolveEventById = wrapWithCache(
  _resolveById,
  ({ encoded }) => encoded
);
