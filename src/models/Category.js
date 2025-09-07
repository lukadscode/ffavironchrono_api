const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const Category = sequelize.define(
  "Category",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    age_group: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM("Homme", "Femme", "Mixte"),
      allowNull: true,
    },
    boat_seats: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    has_coxswain: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
  },
  {
    tableName: "categories",
    timestamps: false,
  }
);

module.exports = Category;
