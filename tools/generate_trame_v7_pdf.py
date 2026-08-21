"""Génère une trame de contrôle visuel pour le rapport journalier AINM v7.

Le PDF illustre la sortie longue : synthèse terrain, pièces photo, dossier
d'archivage détaillé et annexe financière terminale. La PWA produit elle-même
son PDF par impression navigateur ; ce fichier sert de référence de mise en
page pour la recette et le déploiement.
"""

from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    Flowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "rapport-journalier-ainm-trame-adaptative-v7.pdf"
LOGO = ROOT / "assets" / "ainm-infrapole-paris-sud-est.jpg"

PAGE_W, PAGE_H = A4
GREEN = colors.HexColor("#173e34")
DEEP_GREEN = colors.HexColor("#075444")
PALE_GREEN = colors.HexColor("#eef7f3")
LINE = colors.HexColor("#cddbd6")
TEXT = colors.HexColor("#36534a")
MUTED = colors.HexColor("#60766d")
GOLD = colors.HexColor("#7c5c1a")
PALE_GOLD = colors.HexColor("#fffbf3")
BLUE = colors.HexColor("#eaf8fc")
RED = colors.HexColor("#fff1e8")


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="RJTitle", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=19, leading=22, textColor=GREEN, spaceAfter=3,
))
styles.add(ParagraphStyle(
    name="RJSection", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=14, leading=16, textColor=GREEN, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="RJSub", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8, leading=11, textColor=MUTED, spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="RJBody", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8.2, leading=11.5, textColor=TEXT,
))
styles.add(ParagraphStyle(
    name="RJSmall", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=6.8, leading=8.5, textColor=TEXT,
))
styles.add(ParagraphStyle(
    name="RJKicker", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=7.1, leading=9, textColor=MUTED, uppercase=True,
))
styles.add(ParagraphStyle(
    name="RJCellLabel", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=6.1, leading=7.5, textColor=MUTED,
))
styles.add(ParagraphStyle(
    name="RJCellValue", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=8, leading=10, textColor=GREEN,
))
styles.add(ParagraphStyle(
    name="RJFinance", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=14, leading=16, textColor=GOLD, spaceAfter=4,
))


def p(text, style="RJBody"):
    return Paragraph(escape(str(text)).replace("\n", "<br/>"), styles[style])


class PhotoPlaceholder(Flowable):
    def __init__(self, title, caption, tone=PALE_GREEN):
        super().__init__()
        self.title = title
        self.caption = caption
        self.tone = tone
        self.width = 83 * mm
        self.height = 66 * mm

    def draw(self):
        canvas = self.canv
        canvas.setStrokeColor(LINE)
        canvas.setFillColor(self.tone)
        canvas.roundRect(0, 0, self.width, self.height, 2.2 * mm, fill=1, stroke=1)
        canvas.setFillColor(GREEN)
        canvas.setFont("Helvetica-Bold", 9)
        canvas.drawCentredString(self.width / 2, self.height / 2 + 7 * mm, self.title)
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 7)
        canvas.drawCentredString(self.width / 2, self.height / 2 + 1 * mm, "Photo terrain datée / localisée")
        canvas.setFont("Helvetica", 6.5)
        for index, line in enumerate(self.caption.split("\n")):
            canvas.drawCentredString(self.width / 2, self.height / 2 - (6 + index * 4) * mm, line)


def page_header(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.35)
    canvas.line(14 * mm, PAGE_H - 13 * mm, PAGE_W - 14 * mm, PAGE_H - 13 * mm)
    if LOGO.exists():
        canvas.drawImage(str(LOGO), 14 * mm, PAGE_H - 11.4 * mm, width=27 * mm, height=8.2 * mm, preserveAspectRatio=True, mask="auto")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 6.6)
    canvas.drawRightString(PAGE_W - 14 * mm, PAGE_H - 8.5 * mm, "Rapport journalier AINM - trame adaptative v7")
    canvas.setStrokeColor(LINE)
    canvas.line(14 * mm, 12 * mm, PAGE_W - 14 * mm, 12 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 6.5)
    canvas.drawString(14 * mm, 7.5 * mm, "Référence de mise en page - sortie PWA terrain / archivage")
    canvas.drawRightString(PAGE_W - 14 * mm, 7.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def section_title(title, subtitle, finance=False):
    return [p(title, "RJFinance" if finance else "RJSection"), p(subtitle, "RJSub")]


def info_cell(label, value):
    return [p(label, "RJCellLabel"), Spacer(1, 1.2 * mm), p(value, "RJCellValue")]


def table(rows, widths, header=True, finance=False):
    body = []
    if header:
        body.append([p(cell, "RJSmall") for cell in rows[0]])
        data_rows = rows[1:]
    else:
        data_rows = rows
    for row in data_rows:
        body.append([p(cell, "RJSmall") if not isinstance(cell, Paragraph) else cell for cell in row])
    palette = GOLD if finance else DEEP_GREEN
    result = Table(body, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.3, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        commands.extend([
            ("BACKGROUND", (0, 0), (-1, 0), palette),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ])
    for i in range(1 if header else 0, len(body)):
        if i % 2 == 0:
            commands.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f8fbf9")))
    result.setStyle(TableStyle(commands))
    return result


def note_box(title, value, tone=colors.white, width=180 * mm):
    data = [[p(title, "RJCellLabel")], [p(value, "RJBody")]]
    result = Table(data, colWidths=[width])
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), tone),
        ("BOX", (0, 0), (-1, -1), 0.35, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return result


def signature_box(title, name, signed=False):
    signature = "Visa au doigt disponible dans la PWA" if signed else "Zone de signature"
    data = [[p(title, "RJCellLabel")], [p(name, "RJCellValue")], [Spacer(1, 14 * mm)], [p(signature, "RJSmall")]]
    result = Table(data, colWidths=[87 * mm], rowHeights=[None, None, 17 * mm, None])
    result.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.35, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEABOVE", (0, 3), (-1, 3), 0.35, colors.HexColor("#879a94")),
    ]))
    return result


def build_story():
    story = []
    # 1 - synthèse
    if LOGO.exists():
        story.append(Image(str(LOGO), width=54 * mm, height=17 * mm, kind="proportional"))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Rapport Journalier de Chantier", "RJTitle"))
    story.append(p("Synthèse de terrain - trame de référence AINM", "RJSub"))
    story.append(Table([[p("PROJET / OPERATION - RCT AINM - Tronçon Moret-Montargis", "RJBody")]], colWidths=[180 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), PALE_GREEN), ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#48af94")),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ])))
    story.append(Spacer(1, 4 * mm))
    cards = [
        info_cell("DATE", "21/08/2026"), info_cell("SEANCE", "Nuit - 22:00 à 06:00"), info_cell("METEO", "Nuageux - 17 °C"),
        info_cell("ENTREPRISE", "ETF - TSO"), info_cell("EFFECTIF", "18 personnes"), info_cell("ENGINS", "6 engagés"),
        info_cell("INCIDENT", "Aucun bloquant"), info_cell("VOIES / ZONE", "V1, V2 - PK 80+050 à 80+340"), info_cell("PHOTOS", "8 pièces jointes"),
    ]
    card_table = Table([cards[index:index + 3] for index in range(0, len(cards), 3)], colWidths=[60 * mm] * 3, rowHeights=[26 * mm] * 3)
    card_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.3, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.3, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(card_table)
    story.append(Spacer(1, 4 * mm))
    summary = Table([[note_box("OBJECTIF DE LA SEANCE", "Réaliser les travaux de pose de fourreaux, le déroulage de câble et préparer le support RCT.", width=87 * mm), note_box("SYNTHESE RAPIDE", "Travaux réalisés : pose et déroulage.\nPoints à suivre : contrôle de finition et coordination de livraison.", PALE_GREEN, width=87 * mm)]], colWidths=[90 * mm, 90 * mm])
    summary.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(summary)
    story.append(PageBreak())

    # 2 - prestation terrain
    story.extend(section_title("Prestations saisies sur le terrain", "Quantités, zones et observations. Les prix restent invisibles dans le rapport terrain."))
    story.append(table([
        ["Prestation terrain", "Qté / unité", "Voie / PK", "Observation"],
        ["Pose caniveau GM / TGM", "48 ml", "V1 - PK 80+050", "Béton C25/30"],
        ["Fouille de recherche", "36 m³", "V1 - PK 80+120", "Présence de réseaux existants"],
        ["Pose de fourreaux", "120 ml", "V1 - PK 80+180", "Fourreau PEHD Ø110"],
        ["Déroulage câble", "600 ml", "V1 / V2", "Câble 150 mm²"],
        ["Connexion inductive 1 500 V", "1 u", "V2 - PK 80+240", "Raccordement contrôlé"],
        ["Pose intervalle de décharge", "1 u", "V2 - PK 80+260", "Type RVL 120"],
    ], [58 * mm, 28 * mm, 45 * mm, 49 * mm]))
    story.append(Spacer(1, 6 * mm))
    story.append(note_box("FONCTIONS D’APPLICATION", "Numéro unique, reprise de la dernière nuit, catalogue terrain, photos avant / après, formulaires courts, export JSON et visas." , PALE_GREEN))
    story.append(PageBreak())

    # 3 - photos + observations
    story.extend(section_title("Photos et observations de terrain", "Les photos sont datées, qualifiées et classées Avant nuit / Après nuit."))
    photo_grid = Table([
        [PhotoPlaceholder("Avant nuit", "21/08/2026 - 21:42\nV1 - PK 80+120", BLUE), PhotoPlaceholder("Après nuit", "22/08/2026 - 05:46\nV1 - PK 80+120", PALE_GREEN)],
        [PhotoPlaceholder("Avant nuit", "21/08/2026 - 21:47\nV2 - PK 80+240", BLUE), PhotoPlaceholder("Après nuit", "22/08/2026 - 05:51\nV2 - PK 80+240", PALE_GREEN)],
    ], colWidths=[88 * mm, 88 * mm], rowHeights=[70 * mm, 70 * mm])
    photo_grid.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    story.append(photo_grid)
    story.append(Spacer(1, 5 * mm))
    story.append(note_box("OBSERVATION", "Anomalie n° RJ-000042-01 - Technique - En cours. Câble existant repéré ; relevé transmis à l’entreprise et contrôle planifié." , RED))
    story.append(PageBreak())

    # 4 - identification
    story.extend(section_title("Fiche d’identification de la séance", "Dossier d’archivage détaillé. Toute rubrique renseignée dans l’application est reprise."))
    identity = [
        ["OPERATION / CHANTIER", "RCT AINM - Tronçon Moret-Montargis", "LIEU / SECTEUR", "V1 et V2 - PK 80+050 à 80+340"],
        ["N° RAPPORT", "AINM-RJ-000042-TEST", "N° COMMANDE", "00410"],
        ["ENTREPRISE", "ETF / TSO", "DATE / SEANCE", "21/08/2026 - Nuit"],
        ["DUREE", "6 h", "REDACTEUR", "A. Test"],
        ["MOETx SNCF", "M. SNCF", "REP. ENTREPRISE", "C. Entreprise"],
    ]
    identity_rows = []
    for row in identity:
        identity_rows.append([p(row[0], "RJCellLabel"), p(row[1], "RJCellValue"), p(row[2], "RJCellLabel"), p(row[3], "RJCellValue")])
    identity_table = Table(identity_rows, colWidths=[30 * mm, 60 * mm, 30 * mm, 60 * mm])
    identity_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.3, LINE), ("BACKGROUND", (0, 0), (0, -1), PALE_GREEN), ("BACKGROUND", (2, 0), (2, -1), PALE_GREEN),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(identity_table)
    story.append(Spacer(1, 5 * mm))
    story.append(note_box("OBJECTIF / CONSIGNE", "Préparer les travaux de signalisation, assurer la sécurité de la zone et réaliser les contrôles prévus."))
    story.append(Spacer(1, 3 * mm))
    story.append(note_box("FAITS MARQUANTS / ALEAS / DECISIONS", "Coordination réalisée avec les équipes. Les écarts d’horaires et les actions associées sont archivés dans les pages dédiées."))
    story.append(PageBreak())

    # 5 personnel
    story.extend(section_title("Personnel et intervenants", "Main-d’œuvre engagée pour la séance."))
    story.append(table([
        ["Famille / entreprise", "Fonction", "Effectif", "H / pers.", "Chef d’équipe / observation"],
        ["Entreprise travaux - ETF", "Chef de chantier", "2", "6", "J. Martin - coordination"],
        ["Entreprise travaux - ETF", "Monteur signalisation", "8", "6", "Equipe signalisation"],
        ["Entreprise travaux - TSO", "Conducteur d’engin", "2", "6", "Pelle rail-route"],
        ["SNCF", "RPTx", "1", "6", "Présence chantier"],
        ["SNCF", "KV caténaire", "1", "6", "Consignation"],
        ["Prestataire sécurité", "Annonceur", "2", "6", "Protection chantier"],
    ], [45 * mm, 36 * mm, 20 * mm, 22 * mm, 57 * mm]))
    story.append(PageBreak())

    # 6 engins
    story.extend(section_title("Engins et matériels entreprise", "Moyens engagés, zones et consignes de sécurité."))
    story.append(table([
        ["Engin / famille", "Entreprise", "Nb", "Identification", "Zone / PK", "Observation / sécurité"],
        ["Pelle rail-route\nRail-route / LAM", "ETF", "1", "RR-01", "V1 - PK 80+100", "Plateforme aménagée"],
        ["LAM\nRail-route / LAM", "ETF", "1", "LAM-03", "V1 / V2", "Déjà en voie"],
        ["Camion grue\nManutention / levage", "TSO", "1", "CG-12", "Accès nord", "Balisage vérifié"],
        ["Groupe électrogène\nAutre matériel", "ETF", "1", "GE-04", "V2", "RAS"],
    ], [40 * mm, 23 * mm, 13 * mm, 27 * mm, 37 * mm, 38 * mm]))
    story.append(PageBreak())

    # 7 possessions
    story.extend(section_title("Interceptions, possessions et consignations", "Horaires prévus, accordés, réels et fenêtre d’intervention."))
    story.append(table([
        ["Voie / zone", "Prévu", "Accordé", "Réel", "Intervention", "Référence / observation"],
        ["V1 - PK 80+050", "22:00 - 06:00", "22:00 - 06:00", "22:10 - 05:55", "22:25 - 05:40", "ARF-17 - fin anticipée"],
        ["V2 - PK 80+240", "22:00 - 06:00", "22:00 - 06:00", "22:15 - 05:50", "22:30 - 05:35", "AAN-05 - RAS"],
    ], [30 * mm, 28 * mm, 28 * mm, 28 * mm, 30 * mm, 38 * mm]))
    story.append(Spacer(1, 6 * mm))
    story.append(note_box("TRAVAUX RESTANT / PROCHAINE SEANCE", "Poursuivre le câblage, finaliser la pose de l’intervalle de décharge et réaliser le contrôle final des raccordements.", PALE_GREEN))
    story.append(PageBreak())

    # 8 production + materials
    story.extend(section_title("Travaux détaillés et matériaux", "Détail d’archivage des prestations, consommables et déposes."))
    story.append(table([
        ["Prestation", "Qté", "Voie / PK", "Observation"],
        ["Pose caniveau GM / TGM", "48 ml", "V1 - PK 80+050", "Béton C25/30"],
        ["Déroulage câble 240 mm²", "600 ml", "V1 / V2", "Tension contrôlée"],
        ["Connexion inductive 1 500 V", "1 u", "V2 - PK 80+240", "CIT 1400"],
        ["Pose intervalle de décharge", "1 u", "V2 - PK 80+260", "RVL 120"],
    ], [65 * mm, 25 * mm, 45 * mm, 45 * mm]))
    story.append(Spacer(1, 5 * mm))
    story.append(table([
        ["Elément", "Qté / unité", "Zone", "Référence", "Observation"],
        ["Câble 240 mm² aluminium", "600 ml", "V1 / V2", "Lot 4", "Posé"],
        ["Intervalle de décharge RVL 120", "1 u", "V2 - PK 80+260", "R-120", "Raccordé"],
        ["Béton C25/30", "3 m³", "V1 - PK 80+050", "BL-22", "Caniveau"],
    ], [55 * mm, 26 * mm, 36 * mm, 29 * mm, 44 * mm]))
    story.append(PageBreak())

    # 9 controls and anomalies
    story.extend(section_title("Autocontrôles, anomalies et points à lever", "Contrôles réalisés, réserves et actions associées."))
    story.append(table([
        ["Contrôle", "Résultat", "Zone", "Référence", "Réalisé par / heure", "Observation"],
        ["Contrôle câblage", "Conforme", "V1", "AC-12", "J. Martin - 05:30", "Aucune réserve"],
        ["Contrôle de serrage", "Avec réserve", "V2", "AC-13", "J. Martin - 05:40", "Contre-visite prévue"],
    ], [34 * mm, 23 * mm, 26 * mm, 25 * mm, 37 * mm, 35 * mm]))
    story.append(Spacer(1, 5 * mm))
    story.append(table([
        ["Nature / niveau / statut", "Zone", "Fait constaté", "Mesure prise / suite", "Responsable / échéance"],
        ["Technique - A surveiller - En cours", "V1 - PK 80+120", "Câble existant repéré", "Relevé transmis", "ETF - 22/08/2026"],
        ["Organisation - Information - Terminé", "Accès nord", "Décalage livraison", "Replanification faite", "TSO - 21/08/2026"],
    ], [38 * mm, 28 * mm, 38 * mm, 41 * mm, 35 * mm]))
    story.append(PageBreak())

    # 10 documents, means, signatures
    story.extend(section_title("Documents, moyens SNCF et visas", "Clôture d’archivage de la séance."))
    story.append(table([
        ["Document / fiche", "Référence", "Observation"],
        ["Fiche de libération", "FL-02", "À joindre au dossier"],
        ["PV de contrôle", "AC-12", "Contrôle câblage conforme"],
    ], [70 * mm, 40 * mm, 70 * mm]))
    story.append(Spacer(1, 5 * mm))
    story.append(table([
        ["Fonction SNCF", "Nombre", "Observation"],
        ["RPTx", "1", "Présence chantier"],
        ["KV caténaire", "1", "Consignation"],
        ["KVSE", "1", "Sécurité électrique"],
        ["Agent RSO", "1", "Suivi opérationnel"],
    ], [70 * mm, 30 * mm, 80 * mm]))
    story.append(Spacer(1, 5 * mm))
    signatures = Table([
        [signature_box("REDACTEUR / SURVEILLANT", "A. Test"), signature_box("REPRESENTANT MOETx SNCF", "M. SNCF")],
        [signature_box("REPRESENTANT ENTREPRISE", "C. Entreprise"), signature_box("VISA APRES TRAVAUX", "J. Martin - Chef de chantier", signed=True)],
    ], colWidths=[90 * mm, 90 * mm])
    signatures.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    story.append(signatures)
    story.append(PageBreak())

    # 11 - finance, reserved end appendix
    story.extend(section_title("Annexe de valorisation interne", "Réservée à l’administrateur principal. Cette partie est toujours générée en dernier.", finance=True))
    story.append(table([
        ["Prestation terrain", "Référence PB", "Qté / unité", "P.U. HT", "Montant HT"],
        ["Pose caniveau GM / TGM", "PB-2.3.1", "48 ml", "125,00 €", "6 000,00 €"],
        ["Fouille de recherche", "PB-1.2.3", "36 m³", "38,50 €", "1 386,00 €"],
        ["Pose de fourreaux", "PB-3.4.2", "120 ml", "17,80 €", "2 136,00 €"],
        ["Déroulage câble", "PB-4.5.1", "600 ml", "4,20 €", "2 520,00 €"],
        ["Total valorisé indicatif HT", "", "", "", "12 042,00 €"],
    ], [67 * mm, 34 * mm, 28 * mm, 26 * mm, 25 * mm], finance=True))
    story.append(Spacer(1, 7 * mm))
    story.append(note_box("CONTROLE ADMINISTRATIF", "Les prix, références PB et montants ne sont pas affichés aux agents terrain. Les lignes à qualifier restent réservées au contrôle hebdomadaire de l’administrateur principal.", PALE_GOLD))
    return story


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(OUT), pagesize=A4, leftMargin=14 * mm, rightMargin=14 * mm,
        topMargin=20 * mm, bottomMargin=17 * mm, title="Rapport journalier AINM - trame adaptative v7",
        author="AINM - Rapport journalier PWA",
    )
    document.build(build_story(), onFirstPage=page_header, onLaterPages=page_header)
    print(OUT)


if __name__ == "__main__":
    main()
