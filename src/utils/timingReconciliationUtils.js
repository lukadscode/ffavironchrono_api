/**
 * Détecte les groupes d'impulsions proches (double chrono multi-appareils).
 * @param {Array} timings - timings enrichis ou bruts avec timestamp, device_id, status
 * @param {number} thresholdMs - fenêtre de proximité (défaut 500 ms)
 */
function findDuplicateGroups(timings, thresholdMs = 500) {
  const active = timings
    .filter((t) => t.status !== "hidden" && t.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const groups = [];
  let i = 0;

  while (i < active.length) {
    const group = [active[i]];
    let j = i + 1;

    while (j < active.length) {
      const delta =
        new Date(active[j].timestamp).getTime() -
        new Date(group[0].timestamp).getTime();
      if (delta <= thresholdMs) {
        group.push(active[j]);
        j++;
      } else {
        break;
      }
    }

    if (group.length >= 2) {
      const deviceIds = new Set(
        group.map((t) => t.device_id || "poste-inconnu")
      );
      const pendingCount = group.filter((t) => t.status === "pending").length;
      if (deviceIds.size > 1 || pendingCount >= 2) {
        groups.push(group);
      }
    }

    i = j > i + 1 ? j : i + 1;
  }

  return groups;
}

module.exports = { findDuplicateGroups };
