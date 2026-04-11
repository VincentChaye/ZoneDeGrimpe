import { ObjectId } from "mongodb";

/**
 * Récupère le displayName d'un utilisateur depuis sa collection.
 * @param {Collection} usersCollection - Collection MongoDB des users
 * @param {string} uid - ID de l'utilisateur
 * @returns {Promise<string>}
 */
export async function getDisplayName(usersCollection, uid) {
  try {
    const u = await usersCollection.findOne(
      { _id: new ObjectId(uid) },
      { projection: { displayName: 1 } }
    );
    return u?.displayName || "Utilisateur";
  } catch {
    return "Utilisateur";
  }
}
