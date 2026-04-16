/** Durées de vie UIAA/fabricant par défaut (années), null = non-EPI */
export const EPI_DEFAULTS = {
  rope:     10,
  harness:  10,
  quickdraw:10,
  helmet:   10,
  sling:    10,
  belay:    null,
  nuts:     null,
  cams:     null,
  shoes:    null,
  bag:      null,
  other:    null,
};

/**
 * Calcule le statut EPI d'un item à partir de son âge.
 * @param {object} item   - Document user_materiel
 * @param {object|null} spec - Document materiel_specs (pour uiaaLifetimeYears)
 * @returns {"ok"|"watch"|"retire"|null}  null si la catégorie n'est pas un EPI
 */
export function computeEpiStatus(item, spec) {
  const lifetime = spec?.uiaaLifetimeYears ?? EPI_DEFAULTS[item.category] ?? null;
  if (lifetime === null) return null;

  const start = item.firstUseDate || item.purchaseDate;
  if (!start) return "ok";

  const ageYears = (Date.now() - new Date(start).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (ageYears >= lifetime) return "retire";
  if (ageYears >= lifetime * 0.8) return "watch";
  return "ok";
}
