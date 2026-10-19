import { Event, nip19 } from "nostr-tools";

export interface PollOption {
  id: string;
  label: string;
}

export interface PollPreview {
  question: string;
  type: string;
  options: PollOption[];
  endsAt?: number;
}

/**
 * A small, cache-friendly projection of an event — enough for a link/preview
 * card without shipping the whole event. `content` is untrusted and must be
 * rendered as text, never as HTML.
 */
export interface EventPreview {
  kind: number;
  id: string;
  author: string;
  created_at: number;
  /** Canonical shareable reference: naddr for addressable kinds, else nevent. */
  reference: string;
  /** Canonical link into the live pollerama app, for kinds it can render. */
  url?: string;
  title?: string;
  summary?: string;
  image?: string;
  content?: string;
  /** Articles (kind 30023) carry a distinct publication time. */
  published_at?: number;
  /** Present for polls (kind 1068). */
  poll?: PollPreview;
}

/**
 * Canonical public origin for pollerama links. With the pollerama-web front
 * door this is pollerama.fun; the Vercel deployment is only a fallback.
 * Override with POLLERAMA_URL.
 */
const polleramaBase = () =>
  (process.env.POLLERAMA_URL ?? "https://pollerama.fun").replace(/\/$/, "");

/** Kinds pollerama can open; anything else gets no `url`. */
const POLLERAMA_KINDS = new Set([1, 1068, 30023]);

/** Pollerama's client routes: notes/polls at /note/:nevent, articles by naddr. */
const buildUrl = (kind: number, reference: string): string | undefined => {
  if (!POLLERAMA_KINDS.has(kind)) return undefined;
  const base = polleramaBase();
  return kind === 30023
    ? `${base}/feeds/articles/${reference}`
    : `${base}/note/${reference}`;
};

const ADDRESSABLE_MIN = 30000;
const ADDRESSABLE_MAX = 40000;

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?[^\s]*)?$/i;
const URL_RE = /https?:\/\/[^\s]+/g;
const SUMMARY_MAX = 280;

const tagValue = (event: Event, name: string): string | undefined =>
  event.tags.find((tag) => tag[0] === name)?.[1];

const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

const firstImageUrl = (content: string): string | undefined =>
  (content.match(URL_RE) ?? []).find((url) => IMAGE_EXT.test(url));

/** NIP-92 `imeta`, then a plain `image` tag, then the first image URL in content. */
const extractImage = (event: Event): string | undefined => {
  for (const tag of event.tags) {
    if (tag[0] !== "imeta") continue;
    const url = tag.slice(1).find((part) => part.startsWith("url "));
    if (url) return url.slice("url ".length);
  }
  return tagValue(event, "image") ?? firstImageUrl(event.content);
};

const encodeReference = (event: Event): string => {
  const identifier = tagValue(event, "d");
  if (
    identifier !== undefined &&
    event.kind >= ADDRESSABLE_MIN &&
    event.kind < ADDRESSABLE_MAX
  ) {
    return nip19.naddrEncode({
      kind: event.kind,
      pubkey: event.pubkey,
      identifier,
    });
  }
  return nip19.neventEncode({
    id: event.id,
    kind: event.kind,
    author: event.pubkey,
  });
};

const buildPoll = (event: Event): PollPreview => {
  const endsAt = tagValue(event, "endsAt");
  return {
    question: event.content,
    type: tagValue(event, "polltype") ?? "singlechoice",
    options: event.tags
      .filter((tag) => tag[0] === "option" && tag[1] !== undefined)
      .map((tag) => ({ id: tag[1], label: tag[2] ?? tag[1] })),
    ...(endsAt !== undefined ? { endsAt: Number(endsAt) } : {}),
  };
};

export const buildEventPreview = (event: Event): EventPreview => {
  const reference = encodeReference(event);
  const preview: EventPreview = {
    kind: event.kind,
    id: event.id,
    author: event.pubkey,
    created_at: event.created_at,
    reference,
    url: buildUrl(event.kind, reference),
  };

  switch (event.kind) {
    case 1068: // NIP-88 poll
      preview.title = event.content || "Poll";
      preview.content = event.content;
      preview.poll = buildPoll(event);
      break;

    case 30023: // NIP-23 long-form article
      preview.title = tagValue(event, "title");
      preview.summary = tagValue(event, "summary");
      preview.image = tagValue(event, "image") ?? firstImageUrl(event.content);
      preview.content = event.content;
      if (tagValue(event, "published_at") !== undefined) {
        preview.published_at = Number(tagValue(event, "published_at"));
      }
      break;

    default: // short-text notes (1) and replies, and anything else
      preview.title = tagValue(event, "subject");
      preview.summary = truncate(event.content.trim(), SUMMARY_MAX);
      preview.content = event.content;
      preview.image = extractImage(event);
      break;
  }

  return preview;
};
