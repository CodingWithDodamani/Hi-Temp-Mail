import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Graceful fallback for Vercel/serverless where DATABASE_URL is not set
// The app is client-only (Mail.tm + localStorage) — this DB is optional
function createClient() {
  if (!process.env.DATABASE_URL) {
    console.warn("[db] DATABASE_URL not set — Prisma disabled (app runs without DB)");
    return null as unknown as PrismaClient
  }
  try {
    return new PrismaClient({ log: ['warn', 'error'] })
  } catch (e) {
    console.warn("[db] Prisma init failed:", e)
    return null as unknown as PrismaClient
  }
}

export const db =
  globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production' && db) globalForPrisma.prisma = db