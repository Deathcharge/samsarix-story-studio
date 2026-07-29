export const ENV = {
  authMode: "local" as const,
  host: process.env.HOST?.trim() || "127.0.0.1",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
