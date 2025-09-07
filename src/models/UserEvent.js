const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const UserEvent = sequelize.define(
  "UserEvent",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    event_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("viewer", "editor", "referee", "organiser"),
      defaultValue: "viewer",
    },
  },
  {
    tableName: "user_events",
    timestamps: true,
    underscored: true,
  }
);

module.exports = UserEvent;
