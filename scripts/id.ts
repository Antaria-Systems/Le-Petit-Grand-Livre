import { randomBytes } from "node:crypto";

/** Identifiant opaque (non devinable) pour les documents. */
export const createId = () => "d" + randomBytes(12).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "x");
