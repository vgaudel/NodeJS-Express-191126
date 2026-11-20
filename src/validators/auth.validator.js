// Validation de la connexion (E04) : { email, password }
function validateLogin(data) {
  const errors = [];
  if (typeof data.email !== 'string' || !data.email.includes('@')) errors.push('email : adresse e-mail obligatoire');
  if (typeof data.password !== 'string' || data.password.length === 0) errors.push('password : obligatoire');
  return errors;
}

module.exports = { validateLogin };
