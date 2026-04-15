const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const EnduranceMerImportResult = sequelize.define(
  "EnduranceMerImportResult",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    epreuve_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    epreuve_libelle: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    place: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    club_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    club_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    crew_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    time_raw: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    time_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_mixed_clubs: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    club_codes_mixed: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    points_attributed: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    event_format: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "enduro | brs",
    },
    event_level: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "territorial | championnat_france",
    },
    partants_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    import_batch_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "endurance_mer_import_results",
    underscored: true,
    timestamps: false,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = EnduranceMerImportResult;
