export const ENV = {
  /** Path to the SQLite database file */
  databasePath: process.env.DATABASE_PATH || "./ripple.db",

  /** API key required to publish briefs via n8n.publish */
  publishApiKey: process.env.PUBLISH_API_KEY || "",

  /** App title shown in HTML head */
  appTitle: process.env.APP_TITLE || "The Daily Ripple",

  /** Port to listen on */
  port: parseInt(process.env.PORT || "3001", 10),
} as const;
