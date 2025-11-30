/**
 * Statuts possibles pour un équipage (Crew)
 * 
 * Ces statuts sont utilisés pour indiquer l'état de participation d'un équipage
 * dans une course ou un événement.
 */
module.exports = {
  // Statut par défaut - équipage inscrit et normal
  REGISTERED: "registered",
  
  // DNS - Did Not Start : L'équipage n'a pas pris le départ
  DNS: "dns",
  
  // DNF - Did Not Finish : L'équipage a commencé mais n'a pas terminé la course
  DNF: "dnf",
  
  // DSQ - Disqualified : L'équipage a été disqualifié
  DSQ: "disqualified",
  
  // Changement d'équipage : L'équipage a été modifié (changement de participants)
  CHANGED: "changed",
  
  // Retiré : L'équipage s'est retiré de la compétition
  WITHDRAWN: "withdrawn",
  
  // Scratch : L'équipage a été retiré avant le départ de la course
  SCRATCH: "scratch",
  
  // Liste de tous les statuts valides (pour validation)
  VALID_STATUSES: [
    "registered",
    "dns",
    "dnf",
    "disqualified",
    "changed",
    "withdrawn",
    "scratch",
  ],
  
  // Labels en français pour l'affichage
  LABELS: {
    registered: "Inscrit",
    dns: "DNS (N'a pas pris le départ)",
    dnf: "DNF (N'a pas terminé)",
    disqualified: "Disqualifié",
    changed: "Changement d'équipage",
    withdrawn: "Retiré",
    scratch: "Scratch",
  },
  
  // Statuts qui empêchent l'équipage de participer
  NON_PARTICIPATING: ["dns", "withdrawn", "scratch"],
  
  // Statuts qui indiquent une participation incomplète
  INCOMPLETE: ["dnf", "disqualified"],
};

