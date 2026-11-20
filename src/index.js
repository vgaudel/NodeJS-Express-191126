// Point d'entrée : mets l'application à l'écoute

'use strict';

const config = require("./config")
const app = require("./app");

const port = config.port;

if(!config.jwtSecret){
    console.error('JWT_SECRET manquant : copiez .env.example en .env et renseignez le.');
    process.exit(1);
}

// app.listen
app.listen(config.port, () => {
    console.log(`Edutrack écoute sur http://localhost:${port}`);
}); 