const TimingAssignment = require("../models/TimingAssignment");
const Timing = require("../models/Timing");
const TimingPoint = require("../models/TimingPoint");

/**
 * Calcule temps de segment, distance et vitesse entre deux points consécutifs.
 * @returns {{ segment_time_ms: number|null, segment_distance_m: number|null, speed_mps: number|null }}
 */
async function calculateSegmentMetrics(timingPointId, crewId, eventId, relativeTimeMs) {
  if (!crewId || !eventId || relativeTimeMs === null || relativeTimeMs === undefined) {
    return { segment_time_ms: null, segment_distance_m: null, speed_mps: null };
  }

  const timingPoints = await TimingPoint.findAll({
    where: { event_id: eventId },
    order: [["order_index", "ASC"]],
  });

  const currentPoint = timingPoints.find((tp) => tp.id === timingPointId);
  if (!currentPoint || currentPoint.order_index <= 1) {
    return { segment_time_ms: null, segment_distance_m: null, speed_mps: null };
  }

  const prevPoint = timingPoints.find(
    (tp) => tp.order_index === currentPoint.order_index - 1
  );
  if (!prevPoint) {
    return { segment_time_ms: null, segment_distance_m: null, speed_mps: null };
  }

  const prevAssignment = await TimingAssignment.findOne({
    where: { crew_id: crewId },
    include: [
      {
        model: Timing,
        as: "timing",
        where: { timing_point_id: prevPoint.id },
        required: true,
      },
    ],
    order: [[{ model: Timing, as: "timing" }, "timestamp", "DESC"]],
  });

  if (!prevAssignment?.timing?.timestamp) {
    return { segment_time_ms: null, segment_distance_m: null, speed_mps: null };
  }

  const prevTime = new Date(prevAssignment.timing.timestamp).getTime();
  const currentTime = relativeTimeMs; // already relative to start

  // Recompute previous relative via timestamps if we have start
  const startPoint = timingPoints[0];
  const startAssignment = await TimingAssignment.findOne({
    where: { crew_id: crewId },
    include: [
      {
        model: Timing,
        as: "timing",
        where: { timing_point_id: startPoint.id },
        required: true,
      },
    ],
    order: [[{ model: Timing, as: "timing" }, "timestamp", "ASC"]],
  });

  let prevRelativeMs = null;
  if (startAssignment?.timing?.timestamp) {
    const startMs = new Date(startAssignment.timing.timestamp).getTime();
    prevRelativeMs = prevTime - startMs;
  }

  if (prevRelativeMs === null || prevRelativeMs < 0) {
    return { segment_time_ms: null, segment_distance_m: null, speed_mps: null };
  }

  const segmentTimeMs = relativeTimeMs - prevRelativeMs;
  if (segmentTimeMs <= 0) {
    return { segment_time_ms: null, segment_distance_m: null, speed_mps: null };
  }

  const segmentDistanceM = Math.max(
    0,
    (currentPoint.distance_m || 0) - (prevPoint.distance_m || 0)
  );

  const speedMps =
    segmentDistanceM > 0 ? segmentDistanceM / (segmentTimeMs / 1000) : null;

  return {
    segment_time_ms: segmentTimeMs,
    segment_distance_m: segmentDistanceM > 0 ? segmentDistanceM : null,
    speed_mps: speedMps,
  };
}

module.exports = { calculateSegmentMetrics };
