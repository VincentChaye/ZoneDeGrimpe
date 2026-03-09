import { z } from "zod";

/** Nombres longitude/latitude sûrs */
const lon = z.number().min(-180).max(180);
const lat = z.number().min(-90).max(90);

/** Point GeoJSON : { type:"Point", coordinates:[lng,lat] } */
export const pointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z
    .tuple([lon, lat])
    // Normalisation : arrondi à 6 décimales
    .transform(([lng, la]) => [
      Math.round(lng * 1e6) / 1e6,
      Math.round(la * 1e6) / 1e6,
    ]),
});

/** Création d’un spot (document stocké dans la collection) */
export const createSpotSchema = z.object({
  name       : z.string().min(1).max(120),
  location   : pointSchema,                          // GeoJSON Point {type,coordinates:[lng,lat]}
  type       : z.enum(["crag", "boulder", "indoor"]).default("crag"),
  soustype   : z.enum(["diff", "bloc"]).nullable().optional(),
  niveau_min : z.string().max(10).nullable().optional(),
  niveau_max : z.string().max(10).nullable().optional(),
  orientation: z.enum(["N","S","E","O","NE","SE","SO","NO"]).nullable().optional(),
  id_voix    : z.array(z.any()).default([]),
  url        : z.string().url().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  info_complementaires: z.object({
    rock       : z.string().max(50).nullable().optional(),
    orientation: z.string().max(10).nullable().optional(),
  }).nullable().optional(),
});

/** Query pour GET /api/spots (bbox + limit) */
export const listQuerySchema = z
  .object({
    minLng: z.coerce.number().min(-180).max(180).optional(),
    minLat: z.coerce.number().min(-90).max(90).optional(),
    maxLng: z.coerce.number().min(-180).max(180).optional(),
    maxLat: z.coerce.number().min(-90).max(90).optional(),
    limit: z.coerce.number().int().min(1).max(5000).default(1000),
  })
  .refine(
    (q) =>
      [q.minLng, q.minLat, q.maxLng, q.maxLat].every((v) => v === undefined) ||
      [q.minLng, q.minLat, q.maxLng, q.maxLat].every((v) => v !== undefined),
    { message: "bbox incomplète : fournir minLng,minLat,maxLng,maxLat ou rien" }
  );

/** Query pour GET /api/spots/near */
export const nearQuerySchema = z.object({
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  radius: z.coerce.number().int().min(1).max(100000).default(5000), // en mètres
});

/** :id Mongo (24 hex) – utile si tu veux valider avant ObjectId() */
export const idParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "invalid_object_id"),
});

/** Schema pour la mise à jour partielle d'un spot (PATCH) */
export const updateSpotSchema = z.object({
  name       : z.string().min(1).max(120).optional(),
  type       : z.enum(["crag", "boulder", "indoor"]).optional(),
  soustype   : z.enum(["diff", "bloc"]).nullable().optional(),
  niveau_min : z.string().max(10).nullable().optional(),
  niveau_max : z.string().max(10).nullable().optional(),
  orientation: z.enum(["N","S","E","O","NE","SE","SO","NO"]).nullable().optional(),
  url        : z.string().url().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "Au moins un champ doit être fourni pour la mise à jour" }
);
