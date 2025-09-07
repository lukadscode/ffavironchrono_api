const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const UserSession = sequelize.define(
  "UserSession",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    refresh_token_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    user_agent: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "user_sessions",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = UserSession;
