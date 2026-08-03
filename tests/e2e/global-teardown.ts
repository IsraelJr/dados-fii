import { rm } from "node:fs/promises";
import { VERCEL_BYPASS_STORAGE_STATE } from "./global-setup";

export default async function globalTeardown() {
  await rm(VERCEL_BYPASS_STORAGE_STATE, { force: true });
}
