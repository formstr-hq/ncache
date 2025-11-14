import { Event, SimplePool } from "nostr-tools";
import { DecodedNaddr } from "nostr-tools/lib/types/nip19";
import { wrapWithCache } from "./cache";

const _resolveNAdder = async ({
  naddr,
}: {
  naddr: DecodedNaddr["data"];
  encodedNAddr: string;
}): Promise<Event | null> => {
  if (!naddr.relays) {
    return null;
  }
  const pool = new SimplePool();
  const pubKey = naddr.pubkey;
  const identifier = naddr.identifier;
  const kind = naddr.kind;

  let formIdPubkey = pubKey;
  let relayList = naddr.relays;
  const filter = {
    kinds: [kind],
    authors: [formIdPubkey],
    "#d": [identifier],
  };
  console.log(`fetching event with filter`, JSON.stringify(filter));
  return new Promise((resolve) => {
    const subCloser = pool.subscribeMany(relayList, filter, {
      onevent: (event: Event) => {
        resolve(event);
        subCloser.close();
      },
    });
    setTimeout(() => {
      subCloser.close();
      resolve(null);
    }, 10000);
  });
};

export const resolveNAdder = wrapWithCache(
  _resolveNAdder,
  ({ encodedNAddr }) => encodedNAddr
);
