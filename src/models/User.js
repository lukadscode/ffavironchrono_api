const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    slug: {
      type: DataTypes.CHAR(12),
      unique: true,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      defaultValue: "inactive",
    },
    role: {
      type: DataTypes.ENUM("user", "admin", "superadmin"),
      defaultValue: "user",
    },
    num_license: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    email_verification_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reset_password_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reset_password_expires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "users",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = User;
