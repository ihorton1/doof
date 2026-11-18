import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

declare global {
  var boltsPrisma: PrismaClient | undefined;
}

export function getPrisma() {
  if (globalThis.boltsPrisma) return globalThis.boltsPrisma;

  const connectionString = process.env.BOLTS_DATABASE_URL;
  if (!connectionString) {
    throw new Error("BOLTS_DATABASE_URL is not set. Configure Bolts' own database before using the app.");
  }

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  globalThis.boltsPrisma = client;
  return client;
}
