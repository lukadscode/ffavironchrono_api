const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const Distance = sequelize.define(
  "Distance",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    meters: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
  },
  {
    tableName: "distances",
    timestamps: false,
    underscored: true,
  }
);

// Méthode d'instance pour obtenir un label formaté
Distance.prototype.getFormattedLabel = function () {
  if (this.is_relay && this.relay_count) {
    return `${this.relay_count}x${this.meters}m`;
  }
  return `${this.meters}m`;
};

// Getter virtuel pour le label (accessible via distance.label)
Object.defineProperty(Distance.prototype, "label", {
  get: function () {
    return this.getFormattedLabel();
  },
});

module.exports = Distance;
