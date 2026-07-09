import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../server/routers";

/**
 * tRPC Client Setup
 * Provides type-safe API calls from React components
 */

export const trpc = createTRPCReact<AppRouter>();

/** sessionStorage key holding the admin (PUBLISH_API_KEY) for the editorial queue.
 *  Only ever set on /admin/signals; cleared when the tab closes. */
export const ADMIN_KEY_STORAGE = "ripple_admin_key";

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      async headers() {
        // Attach the admin key when present so the guarded editorial mutations
        // (apiKeyProcedure) authorise; public procedures ignore it.
        const key =
          typeof sessionStorage !== "undefined" ? sessionStorage.getItem(ADMIN_KEY_STORAGE) : null;
        return key ? { "x-api-key": key } : {};
      },
    }),
  ],
});
