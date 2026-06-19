import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export const createContext = ({ req, res }: CreateExpressContextOptions) => ({
  req,
  res,
});

type Context = ReturnType<typeof createContext>;

const t = initTRPC.context<Context>().create();

export const publicProcedure = t.procedure;

/** Requires X-Api-Key header matching PUBLISH_API_KEY env var. */
export const apiKeyProcedure = t.procedure.use(({ ctx, next }) => {
  const key = ctx.req.headers["x-api-key"] as string | undefined;
  const expected = process.env.PUBLISH_API_KEY;
  if (!expected || key !== expected) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid or missing API key",
    });
  }
  return next({ ctx });
});

export const router = t.router;
export const middleware = t.middleware;
