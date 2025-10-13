module.exports = (io) => ({
  sendTiming: (data) => {
    io.emit("timing:new", data);
    if (data.race_id) io.to(`race_${data.race_id}`).emit("timing:new", data);
    if (data.event_id) io.to(`event_${data.event_id}`).emit("timing:new", data);
  },

  updateCrewStatus: ({ crew_id, status, race_id, event_id }) => {
    const payload = { crew_id, status };
    io.emit("crew:status", payload);
    if (race_id) io.to(`race_${race_id}`).emit("crew:status", payload);
    if (event_id) io.to(`event_${event_id}`).emit("crew:status", payload);
  },

  updateRacePhase: ({ race_id, phase }) => {
    io.to(`race_${race_id}`).emit("race:phase", { race_id, phase });
  },

  updateStartList: ({ event_id, races }) => {
    io.to(`event_${event_id}`).emit("event:startlist", { races });
  },

  notifyMessage: ({ event_id, type, message }) => {
    io.to(`event_${event_id}`).emit("event:message", { type, message });
  },

  emitRaceStatusUpdate: ({ event_id, race_id, status }) => {
    io.to(`event:${event_id}`).emit("raceStatusUpdate", { race_id, status });
  },

  emitRaceIntermediateUpdate: ({ event_id, race_id, crew_id, timing_point_id, timing_point_label, distance_m, time_ms, order_index }) => {
    io.to(`event:${event_id}`).emit("raceIntermediateUpdate", {
      race_id,
      crew_id,
      timing_point_id,
      timing_point_label,
      distance_m,
      time_ms,
      order_index,
    });
  },

  emitRaceFinalUpdate: ({ event_id, race_id, crew_id, final_time }) => {
    io.to(`event:${event_id}`).emit("raceFinalUpdate", {
      race_id,
      crew_id,
      final_time,
    });
  },
});
