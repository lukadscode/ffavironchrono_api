const PDFDocument = require("pdfkit");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const Distance = require("../models/Distance");
const RaceCrew = require("../models/RaceCrew");
const Crew = require("../models/Crew");
const Category = require("../models/Category");
const Event = require("../models/Event");
const CrewParticipant = require("../models/CrewParticipant");
const Participant = require("../models/Participant");

function trunc(s = "", len) {
  const str = String(s ?? "");
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function drawDocumentHeader(doc, event, phase, title) {
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .text(event?.name || "Événement", 50, 50, { align: "center" });

  doc
    .fontSize(12)
    .font("Helvetica")
    .fillColor("#555")
    .text(event?.location || "", 50, 75, { align: "center" });

  doc
    .fontSize(10)
    .text(
      `${formatDate(event?.start_date)} - ${formatDate(event?.end_date)}`,
      50,
      90,
      { align: "center" }
    );

  doc
    .moveTo(50, 110)
    .lineTo(545, 110)
    .strokeColor("#000")
    .lineWidth(2)
    .stroke();

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor("#000")
    .text(title, 50, 125);

  doc
    .fontSize(11)
    .font("Helvetica")
    .fillColor("#555")
    .text(phase?.name || "", 50, 145);

  doc
    .fontSize(9)
    .fillColor("#888")
    .text(`Généré le ${formatDate(new Date())} à ${formatTime(new Date())}`, 50, 160);

  doc
    .moveTo(50, 180)
    .lineTo(545, 180)
    .strokeColor("#ddd")
    .lineWidth(1)
    .stroke();

  doc.fillColor("#000");
}

function drawPageNumber(doc, pageNum, totalPages) {
  doc
    .fontSize(8)
    .fillColor("#888")
    .text(`Page ${pageNum}${totalPages ? ` / ${totalPages}` : ""}`, 50, 820, {
      width: 495,
      align: "right",
    });
  doc.fillColor("#000");
}

async function getPhaseData(phase_id) {
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
              {
                model: CrewParticipant,
                as: "crew_participants",
                include: [
                  {
                    model: Participant,
                    as: "participant",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    order: [["race_number", "ASC"]],
  });

  const phase = races[0]?.RacePhase || (await RacePhase.findByPk(phase_id));
  const event =
    phase?.event_id && (await Event.findByPk(phase.event_id));

  return { races, phase, event };
}

exports.startListPdf = async (req, res) => {
  try {
    const { phase_id } = req.params;
    const { races, phase, event } = await getPhaseData(phase_id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="startlist_${phase?.name || phase_id}.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      autoFirstPage: false,
    });
    doc.pipe(res);

    doc.addPage();
    drawDocumentHeader(doc, event, phase, "LISTE DE DÉPART");

    let y = 200;
    let page = 1;

    const drawRaceBlock = (race) => {
      const laneCount = race.lane_count || 6;
      const blockHeight = 80 + laneCount * 22 + 20;

      if (y + blockHeight > 770) {
        drawPageNumber(doc, page, races.length > 10 ? "..." : "");
        page += 1;
        doc.addPage();
        y = 50;
      }

      doc
        .roundedRect(50, y, 495, blockHeight - 10, 3)
        .strokeColor("#ddd")
        .lineWidth(1)
        .stroke();

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#000")
        .text(
          `Course ${race.race_number ?? ""} - ${race.name || ""}`,
          60,
          y + 15
        );

      const time = formatTime(race.start_time);
      const distance = race.Distance
        ? `${race.Distance.label || race.Distance.name || ""}`
        : "";

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#555")
        .text(`${distance}${time ? ` • Heure de départ: ${time}` : ""}`, 60, y + 35);

      doc
        .moveTo(60, y + 55)
        .lineTo(535, y + 55)
        .strokeColor("#ccc")
        .lineWidth(0.5)
        .stroke();

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor("#333");
      doc.text("Couloir", 60, y + 60, { width: 50 });
      doc.text("Club", 110, y + 60, { width: 200 });
      doc.text("Catégorie", 310, y + 60, { width: 120 });
      doc.text("Équipage", 430, y + 60, { width: 105 });

      doc
        .moveTo(60, y + 75)
        .lineTo(535, y + 75)
        .strokeColor("#ccc")
        .lineWidth(0.5)
        .stroke();

      let lineY = y + 80;
      for (let lane = 1; lane <= laneCount; lane++) {
        const entry = (race.race_crews || []).find((c) => c.lane === lane);
        const club = entry?.crew?.club_name || "";
        const cat = entry?.crew?.category?.label || "";
        const crewCode = entry?.crew?.code || "";

        const bgColor = lane % 2 === 0 ? "#f9f9f9" : "#ffffff";
        doc
          .rect(60, lineY, 475, 20)
          .fillColor(bgColor)
          .fill();

        doc
          .fontSize(10)
          .font("Helvetica")
          .fillColor("#000");
        doc.text(String(lane), 60, lineY + 5, { width: 50, align: "center" });
        doc.text(trunc(club, 30), 110, lineY + 5, { width: 200 });
        doc.text(trunc(cat, 18), 310, lineY + 5, { width: 120 });
        doc.text(trunc(crewCode, 15), 430, lineY + 5, { width: 105 });

        lineY += 20;
      }

      doc
        .moveTo(60, lineY)
        .lineTo(535, lineY)
        .strokeColor("#ccc")
        .lineWidth(0.5)
        .stroke();

      y = lineY + 25;
    };

    races.forEach(drawRaceBlock);

    if (races.length > 0) {
      drawPageNumber(doc, page, "");
    }

    doc.end();
  } catch (err) {
    console.error("Error in startListPdf:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.weighInPdf = async (req, res) => {
  try {
    const { phase_id } = req.params;
    const { races, phase, event } = await getPhaseData(phase_id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="pesee_${phase?.name || phase_id}.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      autoFirstPage: false,
    });
    doc.pipe(res);

    doc.addPage();
    drawDocumentHeader(doc, event, phase, "FEUILLE DE PESÉE");

    let y = 200;
    let page = 1;

    const rows = [];
    for (const r of races) {
      const entries = (r.race_crews || []).sort(
        (a, b) => (a.lane ?? 0) - (b.lane ?? 0)
      );
      for (const e of entries) {
        const participants = (e.crew?.crew_participants || [])
          .filter((cp) => cp.participant)
          .sort((a, b) => {
            if (a.is_coxswain && !b.is_coxswain) return 1;
            if (!a.is_coxswain && b.is_coxswain) return -1;
            return (a.seat_position || 999) - (b.seat_position || 999);
          });

        const crewNames = participants
          .map((cp) => {
            const p = cp.participant;
            const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
            return cp.is_coxswain ? `${name} (B)` : name;
          })
          .join(", ");

        rows.push({
          race_number: r.race_number,
          race_name: r.name,
          time: formatTime(r.start_time),
          lane: e.lane,
          club: e.crew?.club_name || "",
          category: e.crew?.category?.label || "",
          code: e.crew?.code || "",
          crew_names: crewNames || "—",
        });
      }
    }

    const drawTableHeader = () => {
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor("#333");
      doc.text("Course", 50, y, { width: 45 });
      doc.text("Heure", 95, y, { width: 40 });
      doc.text("L", 135, y, { width: 20 });
      doc.text("Club", 155, y, { width: 120 });
      doc.text("Cat.", 275, y, { width: 50 });
      doc.text("Code", 325, y, { width: 50 });
      doc.text("Poids", 375, y, { width: 80 });
      doc.text("Signature", 455, y, { width: 90 });

      y += 12;
      doc
        .moveTo(50, y)
        .lineTo(545, y)
        .strokeColor("#333")
        .lineWidth(1)
        .stroke();
      y += 5;
    };

    drawTableHeader();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (y + 40 > 800) {
        drawPageNumber(doc, page, "");
        page += 1;
        doc.addPage();
        y = 50;
        drawTableHeader();
      }

      const bgColor = i % 2 === 0 ? "#f9f9f9" : "#ffffff";
      doc
        .rect(50, y, 495, 35)
        .fillColor(bgColor)
        .fill();

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#000");
      doc.text(String(row.race_number ?? ""), 50, y + 5, { width: 45 });
      doc.text(row.time, 95, y + 5, { width: 40 });
      doc.text(String(row.lane ?? ""), 135, y + 5, { width: 20 });
      doc.text(trunc(row.club, 18), 155, y + 5, { width: 120 });
      doc.text(trunc(row.category, 8), 275, y + 5, { width: 50 });
      doc.text(trunc(row.code, 8), 325, y + 5, { width: 50 });

      doc
        .fontSize(8)
        .fillColor("#555")
        .text(trunc(row.crew_names, 60), 155, y + 20, { width: 340 });

      doc
        .rect(375, y + 5, 75, 25)
        .strokeColor("#ccc")
        .lineWidth(0.5)
        .stroke();

      doc
        .rect(455, y + 5, 85, 25)
        .strokeColor("#ccc")
        .lineWidth(0.5)
        .stroke();

      y += 35;

      doc
        .moveTo(50, y)
        .lineTo(545, y)
        .strokeColor("#ddd")
        .lineWidth(0.5)
        .stroke();
    }

    if (rows.length > 0) {
      drawPageNumber(doc, page, "");
    }

    doc.end();
  } catch (err) {
    console.error("Error in weighInPdf:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};
