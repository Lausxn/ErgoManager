package com.mgs.ergomanager.service.impl;

import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.mgs.ergomanager.model.PersonalizedAnswer;
import com.mgs.ergomanager.model.PersonalizedEvaluation;
import com.mgs.ergomanager.model.SelfEvaluation;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Draws the PDF report of a personalized evaluation. It only builds the bytes,
 * so the same report can be downloaded or attached to an email.
 */
final class EvaluationReportPdf {

    private static final DateTimeFormatter REPORT_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final Color BRAND_COLOR = new Color(0x1F, 0x5F, 0x8B);
    private static final Color LABEL_BACKGROUND = new Color(0xEE, 0xF3, 0xF7);

    private EvaluationReportPdf() {
    }

    /**
     * Renders the evaluation as a PDF report: the details of the appointment
     * followed by the diagnosis and recommendation of each question. It only
     * returns the bytes, so the same report can be downloaded or attached to an
     * email.
     *
     * @param evaluation evaluation with its appointment, self evaluation, company and ergonomist loaded
     * @param answers    answers of the evaluation, in the order of the questions
     * @return content of the PDF file
     */
    static byte[] render(PersonalizedEvaluation evaluation, List<PersonalizedAnswer> answers) {
        SelfEvaluation selfEvaluation = evaluation.getAppointment().getSelfEvaluation();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        Document document = new Document(PageSize.LETTER, 54, 54, 54, 54);
        try {
            PdfWriter.getInstance(document, output);
            document.addTitle("Reporte de evaluación ergonómica");
            document.addAuthor("MGS - ErgoManager");
            document.open();

            Font brandFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, BRAND_COLOR);
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.BLACK);
            Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, BRAND_COLOR);
            Font labelFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.DARK_GRAY);
            Font valueFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);

            Paragraph header = new Paragraph("MGS  |  ErgoManager", brandFont);
            header.setAlignment(Element.ALIGN_RIGHT);
            document.add(header);

            Paragraph title = new Paragraph("Reporte de evaluación ergonómica", titleFont);
            title.setSpacingBefore(8);
            title.setSpacingAfter(16);
            document.add(title);

            PdfPTable details = new PdfPTable(new float[] {1.2f, 2.8f});
            details.setWidthPercentage(100);
            addRow(details, "Colaborador", selfEvaluation.getEmployeeName(), labelFont, valueFont);
            addRow(details, "Correo", selfEvaluation.getEmployeeEmail(), labelFont, valueFont);
            addRow(details, "Puesto", orDash(selfEvaluation.getEmployeePosition()), labelFont, valueFont);
            addRow(details, "Empresa", selfEvaluation.getCompany().getBusinessName(), labelFont, valueFont);
            addRow(details, "Ergonomista", evaluation.getUser().getFullName(), labelFont, valueFont);
            addRow(details, "Formulario",
                    evaluation.getForm() == null ? "-" : evaluation.getForm().getTitle(), labelFont, valueFont);
            addRow(details, "Fecha de la cita",
                    REPORT_DATE_FORMAT.format(evaluation.getAppointment().getStartDateTime()), labelFont, valueFont);
            addRow(details, "Fecha de evaluación",
                    evaluation.getEvaluatedAt() == null ? "-" : REPORT_DATE_FORMAT.format(evaluation.getEvaluatedAt()),
                    labelFont, valueFont);
            document.add(details);

            for (PersonalizedAnswer answer : answers) {
                addSection(document, answer.getQuestionOrder() + ". " + answer.getStatement(), sectionFont);
                addLabeledText(document, "Diagnóstico", answer.getDiagnosis(), labelFont, valueFont);
                addLabeledText(document, "Recomendación", answer.getRecommendation(), labelFont, valueFont);
            }

            Paragraph footer = new Paragraph(new Chunk("Documento generado por ErgoManager para MGS.",
                    FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 8, Color.GRAY)));
            footer.setSpacingBefore(24);
            document.add(footer);
        } catch (DocumentException exception) {
            throw new IllegalStateException("No se pudo generar el reporte PDF.", exception);
        } finally {
            if (document.isOpen()) {
                document.close();
            }
        }
        return output.toByteArray();
    }

    /**
     * Adds a label and value row to the details table.
     *
     * @param table     details table
     * @param label     name of the value
     * @param value     value to show
     * @param labelFont font of the label
     * @param valueFont font of the value
     */
    private static void addRow(PdfPTable table, String label, String value, Font labelFont, Font valueFont) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, labelFont));
        labelCell.setBackgroundColor(LABEL_BACKGROUND);
        labelCell.setPadding(6);
        PdfPCell valueCell = new PdfPCell(new Phrase(value, valueFont));
        valueCell.setPadding(6);
        table.addCell(labelCell);
        table.addCell(valueCell);
    }

    /**
     * Adds the heading of a question to the document.
     *
     * @param document    document being written
     * @param heading     text of the heading
     * @param headingFont font of the heading
     */
    private static void addSection(Document document, String heading, Font headingFont) {
        Paragraph headingParagraph = new Paragraph(heading, headingFont);
        headingParagraph.setSpacingBefore(18);
        headingParagraph.setSpacingAfter(6);
        document.add(headingParagraph);
    }

    /**
     * Adds a block of free text preceded by its label.
     *
     * @param document  document being written
     * @param label     name of the text
     * @param text      free text written by the ergonomist
     * @param labelFont font of the label
     * @param textFont  font of the text
     */
    private static void addLabeledText(Document document, String label, String text, Font labelFont, Font textFont) {
        Paragraph paragraph = new Paragraph();
        paragraph.add(new Chunk(label + ": ", labelFont));
        paragraph.add(new Chunk(text, textFont));
        paragraph.setSpacingAfter(4);
        document.add(paragraph);
    }

    /**
     * Replaces a missing optional value by a dash.
     *
     * @param value optional value
     * @return the value, or a dash when it is missing
     */
    private static String orDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}
