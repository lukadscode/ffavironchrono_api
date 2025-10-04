const PDFDocument = require("pdfkit");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const Distance = require("../models/Distance");
const RaceCrew = require("../models/RaceCrew");
const Crew = require("../models/Crew");
const Category = require("../models/Category");

// Helper: texte tronqué
function trunc(s = "", len) {
  const str = String(s ?? "");
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

// Dessine un header standard
function drawHeader(doc, title, subtitle) {
  doc
    .fontSize(16)
    .text(title, { align: "left", continued: false })
    .moveDown(0.2)
    .fontSize(10)
    .fillColor("#555")
    .text(subtitle || "", { align: "left" })
    .fillColor("#000")
    .moveDown(0.5);
  doc
    .moveTo(doc.x, doc.y)
    .lineTo(550, doc.y)
    .strokeColor("#999")
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.5);
}

// Nouvelle page avec pied de page
function newPage(doc, pageNum, title) {
  doc.addPage();
  doc
    .fontSize(8)
    .fillColor("#888")
    .text(`${title}`, 40, 20, { width: 515, align: "left" })
    .text(`Page ${pageNum}`, 40, 20, { width: 515, align: "right" });
  doc.fillColor("#000").moveDown(2);
}

async function getPhaseData(phase_id) {
  // Récupère toutes les courses d'une phase avec leurs crews
  const races = await Race.findAll({
    include: [
      { model: RacePhase, where: { id: phase_id }, required: true },
      Distance,
      {
        model: RaceCrew,
        as: "race_crews",
        include: [
          {
            model: Crew,
            as: "crew",
            include: [
              {
                model: Category,
                as: "category",
              },
            ],
          },
        ],
      },
    ],
    order: [["race_number", "ASC"]],
  });
  const phase = races[0]?.RacePhase || (await RacePhase.findByPk(phase_id));
  return { races, phase };
}

exports.startListPdf = async (req, res) => {
  try {
    const { phase_id } = req.params;
    const { races, phase } = await getPhaseData(phase_id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="startlist_${phase?.name || phase_id}.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      autoFirstPage: false,
    });
    doc.pipe(res);

    // Première page
    doc.addPage();
    drawHeader(
      doc,
      `Start list — ${phase?.name || "Phase"}`,
      new Date().toLocaleString()
    );

    let y = doc.y;
    let page = 1;

    const drawRaceBlock = (race) => {
      const laneCount = race.lane_count || 6;
      const rows = laneCount;

      // Hauteur estimée (titre + header + rows * 16 + marge)
      const blockHeight = 20 + 14 + rows * 16 + 12;

      if (y + blockHeight > 780) {
        page += 1;
        newPage(doc, page, `Start list — ${phase?.name || ""}`);
        y = 60;
      }

      // Titre course
      const time = race.start_time
        ? new Date(race.start_time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      const distance = race.Distance
        ? ` • ${race.Distance.label || race.Distance.name || ""}`
        : "";
      doc
        .fontSize(12)
        .text(`${race.race_number ?? ""} — ${race.name}${distance}`, 40, y, {
          continued: true,
        });
      doc
        .fontSize(10)
        .fillColor("#555")
        .text(time ? `  (${time})` : "", { continued: false });
      doc.fillColor("#000");
      y += 14;

      // entête du tableau
      doc.fontSize(9).fillColor("#444");
      doc.text("L", 40, y, { width: 20 });
      doc.text("Club", 60, y, { width: 260 });
      doc.text("Catégorie", 320, y, { width: 120 });
      doc.text("Statut", 440, y, { width: 80, align: "right" });
      doc.fillColor("#000");
      y += 12;

      // ligne de séparation
      doc
        .moveTo(40, y)
        .lineTo(520, y)
        .strokeColor("#ddd")
        .lineWidth(0.5)
        .stroke();
      y += 4;

      // lignes
      for (let lane = 1; lane <= laneCount; lane++) {
        const entry = (race.race_crews || race.RaceCrews || race.crews || []).find(
          (c) => c.lane === lane
        );
        const club = entry?.crew?.club_name || entry?.Crew?.club_name || "";
        const cat =
          entry?.crew?.category?.label || entry?.Crew?.Category?.label || entry?.Crew?.category_label || "";
        const status = entry?.status || "";

        doc.fontSize(10);
        doc.text(String(lane), 40, y, { width: 20 });
        doc.text(trunc(club, 42), 60, y, { width: 260 });
        doc.text(trunc(cat, 20), 320, y, { width: 120 });
        doc.text(trunc(status, 8), 440, y, { width: 80, align: "right" });

        y += 16;
      }

      y += 8; // espace après le block
    };

    races.forEach(drawRaceBlock);

    doc.end();
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.weighInPdf = async (req, res) => {
  try {
    const { phase_id } = req.params;
    const { races, phase } = await getPhaseData(phase_id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="pesee_${phase?.name || phase_id}.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      autoFirstPage: false,
    });
    doc.pipe(res);

    doc.addPage();
    drawHeader(
      doc,
      `Pesée — ${phase?.name || "Phase"}`,
      new Date().toLocaleString()
    );

    let y = doc.y;
    let page = 1;

    const linesPerPage = 38; // table compacte
    let count = 0;

    // Flatten: une ligne par RaceCrew (avec race info)
    const rows = [];
    for (const r of races) {
      const entries = (r.race_crews || r.RaceCrews || r.crews || []).sort(
        (a, b) => (a.lane ?? 0) - (b.lane ?? 0)
      );
      for (const e of entries) {
        rows.push({
          race_number: r.race_number,
          race_name: r.name,
          time: r.start_time
            ? new Date(r.start_time).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          lane: e.lane,
          club: e.crew?.club_name || e.Crew?.club_name || "",
          category: e.crew?.category?.label || e.Crew?.Category?.label || e.Crew?.category_label || "",
          crew_id: e.crew?.id || e.Crew?.id,
        });
      }
    }

    const drawHeaderRow = () => {
      doc.fontSize(9).fillColor("#444");
      doc.text("Course", 40, y, { width: 60 });
      doc.text("Heure", 100, y, { width: 45 });
      doc.text("L", 145, y, { width: 15 });
      doc.text("Club", 160, y, { width: 210 });
      doc.text("Catégorie", 370, y, { width: 90 });
      doc.text("Signature", 460, y, { width: 100 });
      doc.fillColor("#000");
      y += 12;
      doc
        .moveTo(40, y)
        .lineTo(560, y)
        .strokeColor("#ddd")
        .lineWidth(0.5)
        .stroke();
      y += 4;
    };

    drawHeaderRow();

    for (const row of rows) {
      // sauter de page
      if (count > 0 && count % linesPerPage === 0) {
        page += 1;
        newPage(doc, page, `Pesée — ${phase?.name || ""}`);
        y = 60;
        drawHeaderRow();
      }

      doc.fontSize(10);
      const courseLabel = `${row.race_number ?? ""}`;
      doc.text(courseLabel, 40, y, { width: 60 });
      doc.text(row.time, 100, y, { width: 45 });
      doc.text(String(row.lane ?? ""), 145, y, { width: 15 });
      doc.text(trunc(row.club, 40), 160, y, { width: 210 });
      doc.text(trunc(row.category, 18), 370, y, { width: 90 });
      doc.text("", 460, y, { width: 100 }); // zone signature (vide)
      y += 16;
      count++;
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
