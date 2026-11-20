module.exports = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3000,
  // « http://a.fr,http://b.fr » → ['http://a.fr', 'http://b.fr'] ; vide → []
  corsOrigins: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // E04 : secret de signature des jetons JWT. AUCUNE valeur par défaut :
  // un secret « par défaut » serait connu de tous (il est dans le code !).
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
};