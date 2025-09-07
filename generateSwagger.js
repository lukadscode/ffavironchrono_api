const fs = require("fs");
const swaggerSpec = require("./src/docs");

fs.writeFileSync("./swagger.json", JSON.stringify(swaggerSpec, null, 2));
console.log("✅ swagger.json généré !");
