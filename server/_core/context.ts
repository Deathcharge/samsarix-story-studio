import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: Pick<CreateExpressContextOptions, "req" | "res">
): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: await db.getLocalUser(),
  };
}
