// Hachage des mots de passe avec scrypt (E04) — module natif « crypto ».
//
// 🔐 On ne stocke JAMAIS un mot de passe en clair, ni même chiffré (on
// pourrait le déchiffrer). On stocke une EMPREINTE (hash) : impossible de
// revenir au mot de passe, mais on peut vérifier qu'un mot de passe saisi
// produit la même empreinte.
//
// scrypt est volontairement LENT et gourmand en mémoire : un attaquant qui
// vole la base ne peut tester que peu de mots de passe par seconde.
const crypto = require('node:crypto');
const util = require('node:util');

const scrypt = util.promisify(crypto.scrypt); // version Promise (vue en A06 !)
const KEY_LENGTH = 64;

// Renvoie « sel:empreinte » (en hexadécimal).
async function hashPassword(password) {
  // Le SEL est aléatoire et différent pour chaque utilisateur : deux
  // utilisateurs ayant le même mot de passe auront des empreintes différentes.
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [salt, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, salt, KEY_LENGTH);
  // timingSafeEqual compare en temps CONSTANT : la durée de la comparaison
  // ne révèle pas combien d'octets sont identiques (attaque temporelle).
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyPassword };
