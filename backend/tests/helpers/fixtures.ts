import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { createSchema, openDatabase } from "../../src/db/connection.js";
import type { Db } from "../../src/db/types.js";
import { loadSourceData } from "../../src/input/loadSourceData.js";
import type { EventInput, SourceData } from "../../src/input/types.js";
import { buildApp } from "../../src/api/app.js";
import { seedInitialState } from "../../src/seed/buildDatabase.js";

export const source: SourceData = loadSourceData(resolve("data"));

export function createTestDb(): Db {
  const db = openDatabase(":memory:");
  createSchema(db);
  seedInitialState(db, source);
  return db;
}

export function createTestApp(): { app: FastifyInstance; db: Db } {
  const db = createTestDb();
  return { app: buildApp(db), db };
}

export function eventById(eventId: string): EventInput {
  const event = source.events.find((candidate) => candidate.event_id === eventId);
  if (!event) throw new Error(`Event ${eventId} not found in fixtures`);
  return event;
}

export async function postEvent(app: FastifyInstance, event: EventInput) {
  return app.inject({ method: "POST", url: "/events/reservation", payload: event });
}

export async function postEventById(app: FastifyInstance, eventId: string) {
  return postEvent(app, eventById(eventId));
}

export async function getJson<T>(app: FastifyInstance, url: string): Promise<T> {
  const response = await app.inject({ method: "GET", url });
  return response.json() as T;
}
