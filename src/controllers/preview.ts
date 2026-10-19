import { NextFunction, Request, Response } from "express";
import { Event, nip19 } from "nostr-tools";
import { resolveNAdder } from "../services/naddrResolver";
import { resolveEventById } from "../services/eventResolver";
import { buildEventPreview } from "../services/preview";

type Resolution =
  | { ok: true; event: Event }
  | { ok: false; status: number; body: Record<string, unknown> };

/** Decode a naddr/nevent/note reference and resolve it to an event. */
const resolveIdentifier = async (identifier: string): Promise<Resolution> => {
  let decoded: ReturnType<typeof nip19.decode>;
  try {
    decoded = nip19.decode(identifier);
  } catch {
    return { ok: false, status: 400, body: { error: "invalid identifier" } };
  }

  let event: Event | null = null;
  switch (decoded.type) {
    case "naddr":
      event = await resolveNAdder({
        naddr: decoded.data,
        encodedNAddr: identifier,
      });
      break;
    case "nevent":
      event = await resolveEventById({
        id: decoded.data.id,
        relays: decoded.data.relays,
        encoded: identifier,
      });
      break;
    case "note":
      event = await resolveEventById({ id: decoded.data, encoded: identifier });
      break;
    default:
      return {
        ok: false,
        status: 400,
        body: {
          error: `unsupported identifier type: ${decoded.type}`,
          supported: ["naddr", "nevent", "note"],
        },
      };
  }

  return event
    ? { ok: true, event }
    : { ok: false, status: 404, body: { error: "event not found" } };
};

/**
 * Resolve a nostr reference (naddr / nevent / note) and return a normalized
 * preview object plus the raw event. Covers pollerama's shareable kinds: posts
 * and replies (kind 1, nevent/note), polls (kind 1068, nevent/note) and
 * articles (kind 30023, naddr).
 */
export const preview = async (
  req: Request<{ identifier: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const resolution = await resolveIdentifier(req.params.identifier);
    if (!resolution.ok) {
      return res.status(resolution.status).send(resolution.body);
    }
    return res.send({
      preview: buildEventPreview(resolution.event),
      event: resolution.event,
    });
  } catch (e) {
    next(e);
  }
};

/**
 * Resolve a reference and redirect the browser into the live pollerama app
 * (Pollerama isn't self-hosted — we point at the configured POLLERAMA_URL). Used
 * so a shared link lands on the real app instead of a JSON payload.
 */
export const openEvent = async (
  req: Request<{ identifier: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const resolution = await resolveIdentifier(req.params.identifier);
    if (!resolution.ok) {
      return res.status(resolution.status).send(resolution.body);
    }
    const url = buildEventPreview(resolution.event).url;
    if (!url) {
      return res
        .status(404)
        .send({ error: "no pollerama destination for this event" });
    }
    return res.redirect(302, url);
  } catch (e) {
    next(e);
  }
};
