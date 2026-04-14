import { z } from "zod";

/** Nombres longitude/latitude sûrs */
const lon = z.number().min(-180).max(180);
const lat = z.number().min(-90).max(90);

/** Photo d'un spot */
export const photoSchema = z.object({
  _id      : z.string().optional(),
  url      : z.string().url(),
  publicId : z.string().optional(),
  uploadedBy: z.object({ uid: z.string(), displayName: z.string() }).optional(),
  createdAt : z.coerce.date().optional(),
  status   : z.enum(["pending", "approved", "rejected"]).optional(),
});

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
  type       : z.enum(["crag", "boulder", "indoor", "shop"]).default("crag"),
  soustype   : z.enum(["diff", "bloc"]).nullable().optional(),
  niveau_min : z.string().max(10).nullable().optional(),
  niveau_max : z.string().max(10).nullable().optional(),
  orientation: z.enum(["N","S","E","O","NE","SE","SO","NO"]).nullable().optional(),
  id_voix    : z.array(z.string()).default([]),
  url        : z.string().url().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  acces      : z.string().max(1000).nullable().optional(),
  equipement : z.enum(["spit","piton","mixte","non_equipe"]).nullable().optional(),
  hauteur    : z.number().int().positive().max(1000).nullable().optional(),
  info_complementaires: z.object({
    rock       : z.string().max(50).nullable().optional(),
    orientation: z.string().max(10).nullable().optional(),
  }).nullable().optional(),
  // photos : champ en lecture seule via PATCH — les photos passent par /api/spots/:id/photos
  photos     : z.array(photoSchema).max(20).optional(),
});

/** Username unique (3-30 chars, alphanum + underscore) */
export const usernameSchema = z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "username_invalid_format");

/** :id Mongo (24 hex) – utile si tu veux valider avant ObjectId() */
export const idParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "invalid_object_id"),
});

/** Schema pour la mise à jour partielle d'un spot (PATCH) */
export const updateSpotSchema = z.object({
  name       : z.string().min(1).max(120).optional(),
  type       : z.enum(["crag", "boulder", "indoor", "shop"]).optional(),
  soustype   : z.enum(["diff", "bloc"]).nullable().optional(),
  niveau_min : z.string().max(10).nullable().optional(),
  niveau_max : z.string().max(10).nullable().optional(),
  orientation: z.enum(["N","S","E","O","NE","SE","SO","NO"]).nullable().optional(),
  url        : z.string().url().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  acces      : z.string().max(1000).nullable().optional(),
  equipement : z.enum(["spit","piton","mixte","non_equipe"]).nullable().optional(),
  hauteur    : z.number().int().positive().max(1000).nullable().optional(),
  info_complementaires: z.object({
    rock       : z.string().max(50).nullable().optional(),
    orientation: z.string().max(10).nullable().optional(),
  }).nullable().optional(),
  // photos intentionnellement absent : les modifs passent par /api/spots/:id/photos
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "Au moins un champ doit être fourni pour la mise à jour" }
);
