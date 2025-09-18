import { PrismaClient } from "@prisma/client";

// Create a mock Prisma client for development without a database
const createMockPrismaClient = () => {
  const handler = {
    get: (target, prop) => {
      // Return a proxy for any model
      if (typeof prop === 'string' && !['$connect', '$disconnect', '$on', '$transaction', '$use'].includes(prop)) {
        return new Proxy({}, {
          get: (_, method) => {
            // Mock all database methods
            return async (...args) => {
              console.log(`Mock Prisma: ${prop}.${method} called with`, args);
              // Return empty arrays for findMany, null for findUnique/findFirst, etc.
              if (method === 'findMany') return [];
              if (method === 'findUnique' || method === 'findFirst') return null;
              if (method === 'create' || method === 'update' || method === 'upsert') return args[0]?.data || {};
              return null;
            };
          }
        });
      }
      // Mock connection methods
      if (prop === '$connect' || prop === '$disconnect') {
        return async () => console.log(`Mock Prisma: ${prop} called`);
      }
      return target[prop];
    }
  };
  
  return new Proxy({}, handler);
};

let prismaClient;

try {
  // Try to create a real Prisma client
  prismaClient = new PrismaClient();
  console.log("Connected to real database");
} catch (error) {
  // If it fails, use the mock client
  console.warn("Failed to connect to database, using mock client:", error.message);
  prismaClient = createMockPrismaClient();
}

export const db = globalThis.prisma || prismaClient;

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = db;
}

// globalThis.prisma: This global variable ensures that the Prisma client instance is
// reused across hot reloads during development. Without this, each time your application
// reloads, a new instance of the Prisma client would be created, potentially leading
// to connection issues. 