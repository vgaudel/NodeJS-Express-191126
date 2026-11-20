// Point d'entrée : mets l'application à l'écoute

'use strict';

const app = require("./app");

const port = 3000;

// app.listen
app.listen(port, () => {
    console.log(`Edutrack écoute sur http://localhost:${port}`);
}); 