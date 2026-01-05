import type { Config } from "drizzle-kit";

const dbUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
} satisfies Config;
