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

  emitRaceIntermediateUpdate: ({
    event_id,
    race_id,
    crew_id,
    timing_point_id,
    timing_point_label,
    distance_m,
    time_ms,
    relative_time_ms,
    order_index,
  }) => {
    io.to(`event:${event_id}`).emit("raceIntermediateUpdate", {
      race_id,
      crew_id,
      timing_point_id,
      timing_point_label,
      distance_m,
      time_ms,
      relative_time_ms, // ← NOUVEAU
      order_index,
    });
  },

  emitRaceFinalUpdate: ({
    event_id,
    race_id,
    crew_id,
    final_time,
    relative_time_ms,
  }) => {
    io.to(`event:${event_id}`).emit("raceFinalUpdate", {
      race_id,
      crew_id,
      final_time,
      relative_time_ms, // ← NOUVEAU
    });
  },

  // Diffuser une notification
  broadcastNotification: (notification) => {
    const payload = {
      id: notification.id,
      event_id: notification.event_id,
      race_id: notification.race_id,
      message: notification.message,
      importance: notification.importance,
      created_at: notification.created_at,
    };

    if (notification.race_id) {
      // Notification pour une course spécifique
      io.to(`race_${notification.race_id}`).emit("notification:new", payload);
      // Aussi dans la room de l'événement
      if (notification.event_id) {
        io.to(`event:${notification.event_id}`).emit("notification:new", payload);
      }
    } else if (notification.event_id) {
      // Notification pour tout l'événement
      io.to(`event:${notification.event_id}`).emit("notification:new", payload);
      io.to(`event_${notification.event_id}`).emit("notification:new", payload);
    }
  },

  // Supprimer une notification
  removeNotification: (notification) => {
    const payload = {
      id: notification.id,
      event_id: notification.event_id,
      race_id: notification.race_id,
    };

    if (notification.race_id) {
      io.to(`race_${notification.race_id}`).emit("notification:removed", payload);
      if (notification.event_id) {
        io.to(`event:${notification.event_id}`).emit("notification:removed", payload);
      }
    } else if (notification.event_id) {
      io.to(`event:${notification.event_id}`).emit("notification:removed", payload);
      io.to(`event_${notification.event_id}`).emit("notification:removed", payload);
    }
  },

  // Mettre à jour une notification
  updateNotification: (notification) => {
    const payload = {
      id: notification.id,
      event_id: notification.event_id,
      race_id: notification.race_id,
      message: notification.message,
      importance: notification.importance,
      is_active: notification.is_active,
      updated_at: notification.updated_at,
    };

    if (notification.race_id) {
      io.to(`race_${notification.race_id}`).emit("notification:updated", payload);
      if (notification.event_id) {
        io.to(`event:${notification.event_id}`).emit("notification:updated", payload);
      }
    } else if (notification.event_id) {
      io.to(`event:${notification.event_id}`).emit("notification:updated", payload);
      io.to(`event_${notification.event_id}`).emit("notification:updated", payload);
    }
  },
});
