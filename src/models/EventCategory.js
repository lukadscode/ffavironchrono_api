const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const EventCategory = sequelize.define(
  "EventCategory",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    category_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
  },
  {
    tableName: "event_categories",
    timestamps: false,
    underscored: true,
  }
);

module.exports = EventCategory;
