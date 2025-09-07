// socket.js
module.exports = (io) => {
  // Suivi des connexions par timing point
  const timingPointConnections = {}; // { [timing_point_id]: Set<socket.id> }

  io.on("connection", (socket) => {
    console.log("✅ New socket connection:", socket.id);

    // Join race/event rooms
    socket.on("joinRoom", ({ race_id, event_id }) => {
      if (race_id) socket.join(`race_${race_id}`);
      if (event_id) socket.join(`event_${event_id}`);
    });

    // Leave race/event rooms
    socket.on("leaveRoom", ({ race_id, event_id }) => {
      if (race_id) socket.leave(`race_${race_id}`);
      if (event_id) socket.leave(`event_${event_id}`);
    });

    // Join timing point room
    socket.on("watchTimingPoint", ({ timing_point_id }) => {
      if (!timing_point_id) return;

      socket.join(`point_${timing_point_id}`);

      if (!timingPointConnections[timing_point_id]) {
        timingPointConnections[timing_point_id] = new Set();
      }

      timingPointConnections[timing_point_id].add(socket.id);

      io.to(`point_${timing_point_id}`).emit("timingPointViewerCount", {
        timing_point_id,
        count: timingPointConnections[timing_point_id].size,
      });
    });

    // Leave timing point room
    socket.on("unwatchTimingPoint", ({ timing_point_id }) => {
      if (!timing_point_id) return;

      socket.leave(`point_${timing_point_id}`);

      const set = timingPointConnections[timing_point_id];
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          delete timingPointConnections[timing_point_id];
        } else {
          io.to(`point_${timing_point_id}`).emit("timingPointViewerCount", {
            timing_point_id,
            count: set.size,
          });
        }
      }
    });

    // Broadcast assignment to all clients in the race room
    socket.on("assignTiming", ({ race_id, timing_id, crew_id }) => {
      if (race_id) {
        io.to(`race_${race_id}`).emit("timingAssigned", { timing_id, crew_id });
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log("🔌 Socket disconnected:", socket.id);

      // Clean up from timingPointConnections
      for (const [pointId, socketSet] of Object.entries(
        timingPointConnections
      )) {
        socketSet.delete(socket.id);
        if (socketSet.size === 0) {
          delete timingPointConnections[pointId];
        } else {
          io.to(`point_${pointId}`).emit("timingPointViewerCount", {
            timing_point_id: pointId,
            count: socketSet.size,
          });
        }
      }
    });
  });
};
