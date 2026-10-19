import { Event } from "nostr-tools";
import { DecodedNaddr } from "nostr-tools/lib/types/nip19";
import { wrapWithCache } from "./cache";
import { fetchEvent } from "./relayPool";

const _resolveNAdder = async ({
  naddr,
}: {
  naddr: DecodedNaddr["data"];
  encodedNAddr: string;
}): Promise<Event | null> => {
  const filter = {
    kinds: [naddr.kind],
    authors: [naddr.pubkey],
    "#d": [naddr.identifier],
  };
  console.log(`fetching event with filter`, JSON.stringify(filter));
  return fetchEvent(naddr.relays, filter);
};

export const resolveNAdder = wrapWithCache(
  _resolveNAdder,
  ({ encodedNAddr }) => encodedNAddr
);
