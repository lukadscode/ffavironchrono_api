// socket.js
const jwt = require("jsonwebtoken");
require("dotenv").config();
const logger = require("./utils/logger");
const UserEvent = require("./models/UserEvent");
const Race = require("./models/Race");
const RacePhase = require("./models/RacePhase");
const TimingPoint = require("./models/TimingPoint");

module.exports = (io) => {
  // Suivi des connexions par timing point
  const timingPointConnections = {}; // { [timing_point_id]: Set<socket.id> }

  io.on("connection", (socket) => {
    logger.info({ socket_id: socket.id }, "Socket connected");

    // Auth optionnelle (public autorisé, mais fonctionnalités privées verrouillées)
    // - client public: pas de token → accès uniquement à joinPublicEvent
    // - user token: payload { userId }
    // - timing point token: payload { timing_point_id, event_id, type: 'timing_point' }
    const token =
      socket.handshake?.auth?.token ||
      socket.handshake?.query?.token ||
      null;

    socket.data.auth = { kind: "public" };
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.userId) {
          socket.data.auth = { kind: "user", userId: decoded.userId };
        } else if (decoded?.type === "timing_point" && decoded?.timing_point_id) {
          socket.data.auth = {
            kind: "timing_point",
            timing_point_id: decoded.timing_point_id,
            event_id: decoded.event_id,
          };
        }
      } catch (e) {
        // token invalide → rester en public
        socket.data.auth = { kind: "public" };
      }
    }

    // Join race/event rooms
    socket.on("joinRoom", async ({ race_id, event_id }) => {
      if (socket.data.auth?.kind === "public") return;

      // timing point token: ne peut rejoindre que son event_id, pas un autre
      if (socket.data.auth?.kind === "timing_point") {
        if (event_id && socket.data.auth.event_id !== event_id) return;
      }

      // user token: doit être membre de l'événement
      if (socket.data.auth?.kind === "user") {
        let resolvedEventId = event_id || null;
        if (!resolvedEventId && race_id) {
          const race = await Race.findByPk(race_id);
          if (race) {
            const phase = await RacePhase.findByPk(race.phase_id);
            resolvedEventId = phase?.event_id ?? null;
          }
        }
        if (resolvedEventId) {
          const membership = await UserEvent.findOne({
            where: { user_id: socket.data.auth.userId, event_id: resolvedEventId },
          });
          if (!membership) return;
        } else {
          return;
        }
      }

      if (race_id) {
        socket.join(`race_${race_id}`);
        socket.join(`race:${race_id}`); // Alias pour compatibilité
      }
      if (event_id) {
        socket.join(`event_${event_id}`);
        socket.join(`event:${event_id}`); // Alias pour compatibilité
      }
    });

    socket.on("joinPublicEvent", ({ event_id }) => {
      logger.info({ socket_id: socket.id, event_id }, "Socket join public event");
      socket.join(`event:${event_id}`);
      socket.join(`publicEvent:${event_id}`); // Alias pour compatibilité
    });

    // Leave race/event rooms
    socket.on("leaveRoom", ({ race_id, event_id }) => {
      if (race_id) socket.leave(`race_${race_id}`);
      if (event_id) socket.leave(`event_${event_id}`);
    });

    socket.on("leavePublicEvent", ({ event_id }) => {
      logger.info({ socket_id: socket.id, event_id }, "Socket leave public event");
      socket.leave(`event:${event_id}`);
    });

    // Join timing point room
    socket.on("watchTimingPoint", async ({ timing_point_id }) => {
      if (!timing_point_id) return;
      if (socket.data.auth?.kind === "public") return;
      if (
        socket.data.auth?.kind === "timing_point" &&
        socket.data.auth.timing_point_id !== timing_point_id
      ) {
        return;
      }

      // user token: doit être membre de l'event du timing point
      if (socket.data.auth?.kind === "user") {
        const tp = await TimingPoint.findByPk(timing_point_id);
        if (!tp?.event_id) return;
        const membership = await UserEvent.findOne({
          where: { user_id: socket.data.auth.userId, event_id: tp.event_id },
        });
        if (!membership) return;
      }

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

    // Handle disconnect
    socket.on("disconnect", () => {
      logger.info({ socket_id: socket.id }, "Socket disconnected");

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
