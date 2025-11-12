import { NextFunction, Request, Response } from "express";
import { nip19, Event } from "nostr-tools";
import { resolveNAdder } from "../services/naddrResolver";
import { decryptEventFromViewKey } from "../services/decryptEvent";

export const decoder = async (
  req: Request<{ identifier: string }, {}, {}, { viewKey: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const decodedData = nip19.decode(req.params.identifier);
    let eventDetails: Event | null = null;
    let decyptedContent: unknown | null = null;
    if (decodedData.type === "naddr") {
      eventDetails = await resolveNAdder(decodedData.data);
    }
    if (req.query.viewKey && eventDetails) {
      decyptedContent = decryptEventFromViewKey(
        eventDetails,
        req.query.viewKey
      );
    }
    return res.send({ decoded: decodedData, eventDetails, decyptedContent });
  } catch (e) {
    next(e);
  }
};
