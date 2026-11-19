import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase } from "../db/connection.js";
import { buildApp } from "./app.js";

const dbPath = resolve(process.env.DB_PATH ?? "db/linen.sqlite");
const port = Number(process.env.PORT ?? 3000);

if (!existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}. Run "npm run seed" first.`);
  process.exit(1);
}

const db = openDatabase(dbPath);
const app = buildApp(db);

const shutdown = async (): Promise<void> => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ port, host: "127.0.0.1" });
console.log(`Linen API listening on http://127.0.0.1:${port} (database: ${dbPath})`);
