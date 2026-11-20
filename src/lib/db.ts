import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const globalPourPrisma = globalThis as unknown as { prisma?: PrismaClient };

function creerClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export const db = globalPourPrisma.prisma ?? creerClient();
if (process.env.NODE_ENV !== "production") globalPourPrisma.prisma = db;
