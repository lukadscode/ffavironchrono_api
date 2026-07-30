/**
 * Attribue des positions avec ex-aequo (dead heat).
 * Ex. temps 100, 100, 105 → positions 1, 1, 3
 */
function assignDeadHeatPositions(sortedItems, getTimeMs) {
  let currentPosition = 1;

  return sortedItems.map((item, index) => {
    const time = getTimeMs(item);

    if (time === null || time === undefined) {
      return { ...item, position: null };
    }

    if (index > 0) {
      const prevTime = getTimeMs(sortedItems[index - 1]);
      if (prevTime !== null && prevTime !== undefined && time !== prevTime) {
        currentPosition = index + 1;
      }
    } else {
      currentPosition = 1;
    }

    return { ...item, position: currentPosition };
  });
}

module.exports = { assignDeadHeatPositions };
