export const DATABASE_CONNECTION_EVENT = "mdd:database-connection";
export type DatabaseConnectionState = "ready" | "blocked" | "closed-for-upgrade";
export function announceDatabaseConnection(state: DatabaseConnectionState): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DATABASE_CONNECTION_EVENT, { detail: state }));
}
