import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { iso } from "@/lib/utils";
import { clampLat, clampLon } from "@/lib/engines/geo";
import type { Place, Prefs, SavedRoute } from "@/lib/types";

export const loadCloud = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const prefsRows = await sql<Record<string, unknown>>`
      select prefs from storm_prefs where user_id = ${context.userId} limit 1
    `;
    const placeRows = await sql<Record<string, unknown>>`
      select id, name, lat, lon, kind, created_at
      from storm_places where user_id = ${context.userId}
      order by created_at desc limit 80
    `;
    const routeRows = await sql<Record<string, unknown>>`
      select id, name, origin, dest, origin_lat, origin_lon, dest_lat, dest_lon,
             distance_m, duration_s, gale_score, created_at
      from storm_routes where user_id = ${context.userId}
      order by created_at desc limit 40
    `;
    const places: Place[] = placeRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      lat: Number(r.lat),
      lon: Number(r.lon),
      kind: String(r.kind) as Place["kind"],
      created_at: iso(r.created_at),
    }));
    const routes: SavedRoute[] = routeRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      origin: String(r.origin),
      dest: String(r.dest),
      origin_lat: Number(r.origin_lat),
      origin_lon: Number(r.origin_lon),
      dest_lat: Number(r.dest_lat),
      dest_lon: Number(r.dest_lon),
      distance_m: Number(r.distance_m),
      duration_s: Number(r.duration_s),
      gale_score: Number(r.gale_score),
      created_at: iso(r.created_at),
    }));
    return {
      prefs: (prefsRows[0]?.prefs as Partial<Prefs> | undefined) ?? null,
      places,
      routes,
    };
  });

export const savePrefsCloud = createServerFn({ method: "POST" })
  .validator((input: { prefs: Prefs }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into storm_prefs (user_id, prefs, updated_at)
      values (${context.userId}, ${JSON.stringify(data.prefs)}::jsonb, now())
      on conflict (user_id) do update set prefs = excluded.prefs, updated_at = now()
    `;
    return { ok: true as const };
  });

export const savePlaceCloud = createServerFn({ method: "POST" })
  .validator((input: Place) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into storm_places (id, user_id, name, lat, lon, kind, created_at)
      values (
        ${data.id},
        ${context.userId},
        ${data.name.slice(0, 120)},
        ${clampLat(data.lat)},
        ${clampLon(data.lon)},
        ${data.kind},
        now()
      )
      on conflict (id) do update set
        name = excluded.name, lat = excluded.lat, lon = excluded.lon, kind = excluded.kind
      where storm_places.user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const deletePlaceCloud = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from storm_places where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const saveRouteCloud = createServerFn({ method: "POST" })
  .validator((input: SavedRoute) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into storm_routes (
        id, user_id, name, origin, dest, origin_lat, origin_lon, dest_lat, dest_lon,
        distance_m, duration_s, gale_score, created_at
      ) values (
        ${data.id}, ${context.userId}, ${data.name.slice(0, 120)},
        ${data.origin.slice(0, 160)}, ${data.dest.slice(0, 160)},
        ${clampLat(data.origin_lat)}, ${clampLon(data.origin_lon)},
        ${clampLat(data.dest_lat)}, ${clampLon(data.dest_lon)},
        ${data.distance_m}, ${data.duration_s}, ${data.gale_score}, now()
      )
      on conflict (id) do update set
        name = excluded.name, gale_score = excluded.gale_score
      where storm_routes.user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const deleteRouteCloud = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from storm_routes where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const reportIncident = createServerFn({ method: "POST" })
  .validator((input: { kind: string; lat: number; lon: number; note?: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql`
      insert into storm_reports (id, user_id, kind, lat, lon, note)
      values (
        ${id},
        ${context.userId},
        ${data.kind.slice(0, 40)},
        ${clampLat(data.lat)},
        ${clampLon(data.lon)},
        ${(data.note ?? "").slice(0, 240)}
      )
    `;
    return { ok: true as const, id };
  });
