const XLSX = require("xlsx");
const path = process.argv[2] || "c:\\Users\\LukaDaSilva\\Downloads\\FFaviron-ENDURO-2026-RemonteeResultats_Regates_aviron la rochelle.xlsx";

try {
  const wb = XLSX.readFile(path);
  console.log("Feuilles:", wb.SheetNames.length, "->", wb.SheetNames.slice(0, 5).join(", "), "...");
  // SF1X : structure simple
  const sheet1 = wb.Sheets["SF1X"];
  const data1 = XLSX.utils.sheet_to_json(sheet1, { defval: null, header: 1 });
  console.log("\n--- Feuille SF1X (lignes 1-10) ---");
  data1.slice(0, 10).forEach((row, i) => console.log("Ligne", i + 1, ":", JSON.stringify(row)));
  // U17F4X+ : colonnes supplémentaires pour équipages mixtes (Code Club 2, nb équipiers)
  const sheet2 = wb.Sheets["U17F4X+"];
  const data2 = XLSX.utils.sheet_to_json(sheet2, { defval: null, header: 1 });
  console.log("\n--- Feuille U17F4X+ (lignes 1-12) ---");
  data2.slice(0, 12).forEach((row, i) => console.log("Ligne", i + 1, ":", JSON.stringify(row)));
  // Compter lignes de données (à partir de ligne 6, après en-têtes)
  const dataRows1 = data1.filter((r, i) => i >= 5 && r[0] !== null && r[0] !== "Ex." && !isNaN(Number(r[0]))).length;
  console.log("\n--- SF1X: environ", dataRows1, "lignes de classement (place numérique) ---");
} catch (e) {
  console.error("Erreur:", e.message);
}
