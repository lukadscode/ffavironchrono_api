function resolveStartAndFinishPoints(timingPoints) {
  const sorted = [...timingPoints].sort((a, b) => a.order_index - b.order_index);
  const startPoint = sorted[0] || null;
  const finishPoint =
    sorted.find(
      (tp) =>
        tp.label === "Finish" ||
        tp.label === "finish" ||
        tp.label === "Arrivée" ||
        tp.label === "arrivée"
    ) || sorted[sorted.length - 1] || null;

  return { startPoint, finishPoint, sorted };
}

module.exports = { resolveStartAndFinishPoints };
