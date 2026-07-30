const ROLE_RANK = {
  viewer: 0,
  timing: 1,
  referee: 1,
  editor: 2,
  organiser: 3,
};

function getRank(role) {
  return ROLE_RANK[role] ?? -1;
}

function minRequiredRank(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return 0;
  return Math.min(...roles.map(getRank).filter((r) => r >= 0));
}

module.exports = { ROLE_RANK, getRank, minRequiredRank };

