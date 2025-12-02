const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const Distance = sequelize.define(
  "Distance",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    // NOTE: event_id retiré - les distances sont maintenant globales et partagées entre événements
    // L'association Event <-> Distance se fait via EventDistance
    meters: {
      type: DataTypes.INTEGER,
      allowNull: true, // Nullable pour permettre les courses basées sur le temps
    },
    is_relay: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    relay_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_time_based: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "distances",
    timestamps: false,
    underscored: true,
  }
);

// Méthode d'instance pour obtenir un label formaté
Distance.prototype.getFormattedLabel = function () {
  // Course basée sur le temps
  if (this.is_time_based && this.duration_seconds) {
    const minutes = Math.floor(this.duration_seconds / 60);
    const seconds = this.duration_seconds % 60;

    if (minutes > 0 && seconds > 0) {
      return `${minutes}min ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}min`;
    } else {
      return `${this.duration_seconds}s`;
    }
  }

  // Relais
  if (this.is_relay && this.relay_count && this.meters) {
    return `${this.relay_count}x${this.meters}m`;
  }

  // Course normale basée sur la distance
  if (this.meters) {
    return `${this.meters}m`;
  }

  // Fallback (ne devrait jamais arriver)
  return "Distance inconnue";
};

// Getter virtuel pour le label (accessible via distance.label)
Object.defineProperty(Distance.prototype, "label", {
  get: function () {
    return this.getFormattedLabel();
  },
});

module.exports = Distance;
