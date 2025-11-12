import { Event, nip44 } from "nostr-tools";
import { hexToBytes } from "@noble/hashes/utils.js";

export const decryptEventFromViewKey = (event: Event, viewKey: string) => {
  const conversationKey = nip44.v2.utils.getConversationKey(
    hexToBytes(viewKey),
    event.pubkey
  );
  const decryptedContent = nip44.v2.decrypt(event.content, conversationKey);
  return JSON.parse(decryptedContent);
};
