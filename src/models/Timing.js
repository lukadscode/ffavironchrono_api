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
