const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const TimingPoint = sequelize.define(
  "TimingPoint",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    order_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    distance_m: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "timing_points",
    timestamps: false,
    underscored: true,
  }
);

module.exports = TimingPoint;
