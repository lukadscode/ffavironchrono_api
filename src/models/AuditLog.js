const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const AuditLog = sequelize.define(
  "AuditLog",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    entity_type: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    entity_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    event_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    request_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
  },
  {
    tableName: "audit_logs",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = AuditLog;
