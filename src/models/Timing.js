const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const Timing = sequelize.define(
  "Timing",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    timing_point_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      // Note: La précision millisecondes est gérée au niveau SQL via DATETIME(3)
      // La migration SQL doit être exécutée pour activer les millisecondes
    },
    manual_entry: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    entered_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    device_id: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    client_read_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
      comment: "Clé idempotente générée par l'appareil (sync hors-ligne par lot)",
    },
    race_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: "Indice de course au moment de la capture, avant affectation à un équipage",
    },
    capture_mode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "lane_first | top_first | free_read | crew_follow",
    },
    status: {
      type: DataTypes.ENUM("pending", "assigned", "hidden"),
      defaultValue: "pending",
    },
  },
  {
    tableName: "timings",
    underscored: true,
    timestamps: false,
  }
);

module.exports = Timing;
