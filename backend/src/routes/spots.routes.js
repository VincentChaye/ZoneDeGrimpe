import { Router } from "express";
import { ObjectId } from "mongodb";
import { createSpotSchema, updateSpotSchema } from "../validators.js";
import { requireAuth, requireAdmin } from "../auth.js";

export function spotsRouter(db) {
  const r = Router();
  const spots = db.collection("climbing_spot");

  // Index géospatial requis pour $near / $geoWithin
  // L'index 2dsphere est géré dans db.js pour éviter les conflits

  // Projection enrichie pour l'affichage carte avec toutes les infos nécessaires
  const MAP_PROJECTION = {
  _id: 1,       // identifiant pour faire un GET /api/spots/:id au clic
  name: 1,      // titre du marker / hover
  location: 1,  // coordonnées GeoJSON [lng, lat]
  type: 1,      // type de grimpe (crag, boulder, indoor)
  soustype: 1,  // sous-type détaillé
  niveau_min: 1, // cotation minimale
  niveau_max: 1, // cotation maximale
  id_voix: 1,   // liste des voies
  orientation: 1, // exposition (N, S, E, O, etc.)
  url: 1,       // lien vers fiche externe
  info_complementaires: 1, // informations additionnelles
  description: 1 // description du spot
};

  // --- Créer un spot (admin uniquement) ---
  r.post("/", requireAdmin, async (req, res) => {
    try {
      const parsed = createSpotSchema.parse(req.body); // doit inclure location valide (GeoJSON Point)
      const doc = { ...parsed, createdAt: new Date() };
      const { insertedId } = await spots.insertOne(doc);
      res.status(201).json({ ok: true, id: insertedId });
    } catch (e) {
      res.status(400).json({ error: "invalid_payload", detail: String(e) });
    }
  });

  
  // --- Recherche par proximité (PLACÉE AVANT /:id) ---
  r.get("/near", async (req, res) => {
    const { lng, lat, radius = 5000, limit = 100, format = "geojson" } = req.query;
    if (lng == null || lat == null) {
      return res.status(400).json({ error: "missing_params", detail: "lng and lat are required" });
    }

    const lngNum = parseFloat(lng);
    const latNum = parseFloat(lat);
    const radNum = parseFloat(radius);
    const limNum = Math.max(1, Math.min(parseInt(limit, 10) || 100, 20000)); // garde une borne haute

    try {
      const docs = await spots
        .find(
          {
            location: {
              $near: {
                $geometry: { type: "Point", coordinates: [lngNum, latNum] },
                $maxDistance: radNum,
              },
            },
          },
          { projection: MAP_PROJECTION } // << projection pour la carte
        )
        .limit(limNum)
        .toArray();

      // Format plat (compat front)
      if (format === "flat") {
        const flat = docs.map((d) => ({
          _id: d._id,
          id: d.id ?? d._id.toString(),
          name: d.name ?? "Inconnu",
          type: d.type ?? null,
          soustype: d.soustype ?? null,
          niveau_min: d.niveau_min ?? null,
          niveau_max: d.niveau_max ?? null,
          id_voix: d.id_voix ?? [],
          location: d.location ?? null, // GeoJSON Point [lng, lat]
          url: d.url ?? null,
          info_complementaires: d.info_complementaires ?? null,
          orientation: d.orientation ?? null,
        }));
        return res.json(flat);
      }

      // Par défaut: GeoJSON FeatureCollection
      return res.json({
        type: "FeatureCollection",
        features: docs.map((d) => ({
          type: "Feature",
          geometry: d.location, // <- le bon champ
          properties: {
            id: d._id,
            osm_id: d.id ?? null,
            name: d.name ?? null,
            type: d.type ?? null,
            soustype: d.soustype ?? null,
            niveau_min: d.niveau_min ?? null,
            niveau_max: d.niveau_max ?? null,
            id_voix: d.id_voix ?? [],
            url: d.url ?? null,
            info_complementaires: d.info_complementaires ?? null,
            orientation: d.orientation ?? null,
          },
        })),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // --- Lister (bbox + format) ---
  r.get("/", async (req, res) => {
    try {
      const { minLng, minLat, maxLng, maxLat, limit = 1000, format = "geojson" } = req.query;

      const limNum = Math.max(1, Math.min(parseInt(limit, 10) || 1000, 20000)); // borne haute
      let query = {};

      if (minLng != null && minLat != null && maxLng != null && maxLat != null) {
        const minx = +minLng, miny = +minLat, maxx = +maxLng, maxy = +maxLat;
        query = {
          location: {
            $geoWithin: {
              $geometry: {
                type: "Polygon",
                coordinates: [[
                  [minx, miny],
                  [maxx, miny],
                  [maxx, maxy],
                  [minx, maxy],
                  [minx, miny]
                ]]
              }
            }
          }
        };
      }

      const docs = await spots
        .find(query, { projection: MAP_PROJECTION }) // << projection pour la carte
        .limit(limNum)
        .toArray();

      if (format === "flat") {
        const flat = docs.map((d) => ({
          _id: d._id,
          id: d.id ?? d._id.toString(),
          name: d.name ?? "Inconnu",
          type: d.type ?? null,
          soustype: d.soustype ?? null,
          niveau_min: d.niveau_min ?? null,
          niveau_max: d.niveau_max ?? null,
          id_voix: d.id_voix ?? [],
          location: d.location ?? null,
          url: d.url ?? null,
          info_complementaires: d.info_complementaires ?? null,
          orientation: d.orientation ?? null,
        }));
        return res.json(flat);
      }

      return res.json({
        type: "FeatureCollection",
        features: docs.map((d) => ({
          type: "Feature",
          geometry: d.location,
          properties: {
            id: d._id,
            osm_id: d.id ?? null,
            name: d.name ?? null,
            type: d.type ?? null,
            soustype: d.soustype ?? null,
            niveau_min: d.niveau_min ?? null,
            niveau_max: d.niveau_max ?? null,
            id_voix: d.id_voix ?? [],
            url: d.url ?? null,
            info_complementaires: d.info_complementaires ?? null,
            orientation: d.orientation ?? null,
          },
        })),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // --- Lire une falaise (DÉTAIL COMPLET) ---
  r.get("/:id", async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }
    try {
      const doc = await spots.findOne({ _id: new ObjectId(req.params.id) }); // renvoie TOUT le document
      if (!doc) return res.status(404).json({ error: "not_found" });
      res.json(doc);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // --- Mettre à jour un spot (utilisateur connecté) ---
  r.patch("/:id", requireAuth, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id", detail: "ID invalide" });
    }
    
    try {
      // Valider les données de mise à jour
      const updates = updateSpotSchema.parse(req.body);
      
      // Préparer l'objet de mise à jour
      const updateDoc = {
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      };
      
      // Effectuer la mise à jour
      const result = await spots.findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        updateDoc,
        { returnDocument: 'after' }
      );
      
      if (!result) {
        return res.status(404).json({ error: "not_found", detail: "Spot introuvable" });
      }
      
      return res.status(200).json({ ok: true, spot: result });
    } catch (e) {
      if (e.name === 'ZodError') {
        return res.status(400).json({ 
          error: "invalid_payload", 
          detail: e.errors?.map(err => `${err.path.join('.')}: ${err.message}`).join(', ') || String(e)
        });
      }
      console.error('[PATCH /spots/:id] Error:', e);
      return res.status(500).json({ error: "server_error", detail: "Erreur interne du serveur" });
    }
  });

  // --- Supprimer un spot (admin uniquement) ---
  r.delete("/:id", requireAdmin, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }
    try {
      const result = await spots.deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ deleted: result.deletedCount === 1 });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}
