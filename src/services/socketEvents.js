// services/socketEvents.js
module.exports = (io) => ({
  sendTiming: (data) => {
    // global + par course + par event
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
});
