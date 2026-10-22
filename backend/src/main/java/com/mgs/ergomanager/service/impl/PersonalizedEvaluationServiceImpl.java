package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.model.enums.HistoryType;
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
import com.mgs.ergomanager.dto.personalizedevaluation.PersonalizedEvaluationRequestDTO;
import com.mgs.ergomanager.dto.personalizedevaluation.PersonalizedEvaluationResponseDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.Appointment;
import com.mgs.ergomanager.model.PersonalizedEvaluation;
import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.AppointmentStatus;
import com.mgs.ergomanager.repository.AppointmentRepository;
import com.mgs.ergomanager.repository.HistoryRepository;
import com.mgs.ergomanager.repository.PersonalizedEvaluationRepository;
import com.mgs.ergomanager.security.CurrentUserService;
import com.mgs.ergomanager.service.PersonalizedEvaluationService;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link PersonalizedEvaluationService}. An
 * ergonomist only reads their own evaluations; an administrator reads all.
 */
@Service
public class PersonalizedEvaluationServiceImpl implements PersonalizedEvaluationService {

    private static final String EVALUATION_NOT_FOUND_MESSAGE = "No se encontró la evaluación.";
    private static final String ACCESS_DENIED_MESSAGE = "No tiene permisos para realizar esta acción.";
    private static final String REPORT_PATH_TEMPLATE = "/api/personalized-evaluations/%d/report";
    private static final DateTimeFormatter REPORT_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final Color BRAND_COLOR = new Color(0x1F, 0x5F, 0x8B);
    private static final Color LABEL_BACKGROUND = new Color(0xEE, 0xF3, 0xF7);
    private final PersonalizedEvaluationRepository personalizedEvaluationRepository;
    private final AppointmentRepository appointmentRepository;
    private final HistoryRepository historyRepository;
    private final CurrentUserService currentUserService;

    /**
     * Builds the service with its collaborators.
     *
     * @param personalizedEvaluationRepository repository of personalized evaluations
     * @param appointmentRepository            repository of appointments
     * @param historyRepository                repository of history entries
     * @param currentUserService               access to the signed in user
     */
    public PersonalizedEvaluationServiceImpl(PersonalizedEvaluationRepository personalizedEvaluationRepository,
                                             AppointmentRepository appointmentRepository,
                                             HistoryRepository historyRepository,
                                             CurrentUserService currentUserService) {
        this.personalizedEvaluationRepository = personalizedEvaluationRepository;
        this.appointmentRepository = appointmentRepository;
        this.historyRepository = historyRepository;
        this.currentUserService = currentUserService;
    }

    @Override
    @Transactional
    public PersonalizedEvaluationResponseDTO create(PersonalizedEvaluationRequestDTO request) {
        User ergonomist = currentUserService.getCurrentUser();
        Appointment appointment = appointmentRepository.findDetailedById(request.appointmentId())
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró la cita."));
        if (!Objects.equals(appointment.getUser().getId(), ergonomist.getId())) {
            throw new AccessDeniedException(ACCESS_DENIED_MESSAGE);
        }
        // Checked before the status: an evaluated appointment is already COMPLETED,
        // and "already evaluated" is the more useful answer in that case.
        if (personalizedEvaluationRepository.existsByAppointmentId(appointment.getId())) {
            throw new DuplicateResourceException("Esta cita ya tiene una evaluación.");
        }
        if (!AppointmentServiceImpl.PENDING_STATUSES.contains(appointment.getStatus())) {
            throw new BusinessException("La cita no está pendiente.");
        }

        PersonalizedEvaluation evaluation = new PersonalizedEvaluation();
        evaluation.setAppointment(appointment);
        evaluation.setUser(ergonomist);
        evaluation.setDiagnosis(request.diagnosis());
        evaluation.setRecommendations(request.recommendations());
        evaluation.setRiskLevel(request.riskLevel());
        PersonalizedEvaluation saved = personalizedEvaluationRepository.save(evaluation);
        saved.setReportPath(String.format(REPORT_PATH_TEMPLATE, saved.getId()));
        appointment.setStatus(AppointmentStatus.COMPLETED);

        historyRepository.save(HistoryEntries.of(HistoryType.PERSONALIZED_EVALUATION, appointment.getSelfEvaluation(), saved,
                "Evaluación personalizada registrada. Riesgo " + request.riskLevel().getLabel() + "."));
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public PersonalizedEvaluationResponseDTO findById(Long id) {
        return toResponse(getReadableEvaluation(id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<PersonalizedEvaluationResponseDTO> findByErgonomist(Long userId) {
        currentUserService.checkOwnerOrAdmin(userId);
        return personalizedEvaluationRepository.findDetailedByUserId(userId).stream()
                .map(PersonalizedEvaluationServiceImpl::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] generateReport(Long id) {
        return renderPdf(getReadableEvaluation(id));
    }

    /**
     * Reads an evaluation with its associations and applies the ownership rule.
     *
     * @param id identifier of the evaluation
     * @return the evaluation
     */
    private PersonalizedEvaluation getReadableEvaluation(Long id) {
        PersonalizedEvaluation evaluation = personalizedEvaluationRepository.findDetailedById(id)
                .orElseThrow(() -> new ResourceNotFoundException(EVALUATION_NOT_FOUND_MESSAGE));
        currentUserService.checkOwnerOrAdmin(evaluation.getUser().getId());
        return evaluation;
    }

    /**
     * Renders the evaluation as a one page PDF report.
     *
     * @param evaluation evaluation with its appointment, self evaluation, company and ergonomist loaded
     * @return content of the PDF file
     */
    private static byte[] renderPdf(PersonalizedEvaluation evaluation) {
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
            addRow(details, "Ergónomo", evaluation.getUser().getFullName(), labelFont, valueFont);
            addRow(details, "Fecha de la cita",
                    REPORT_DATE_FORMAT.format(evaluation.getAppointment().getStartDateTime()), labelFont, valueFont);
            addRow(details, "Fecha de evaluación",
                    evaluation.getEvaluatedAt() == null ? "-" : REPORT_DATE_FORMAT.format(evaluation.getEvaluatedAt()),
                    labelFont, valueFont);
            addRow(details, "Nivel de riesgo", evaluation.getRiskLevel().getLabel(), labelFont, valueFont);
            document.add(details);

            addSection(document, "Diagnóstico", evaluation.getDiagnosis(), sectionFont, valueFont);
            addSection(document, "Recomendaciones", evaluation.getRecommendations(), sectionFont, valueFont);

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
     * Adds a titled block of free text to the document.
     */
    private static void addSection(Document document, String heading, String text, Font headingFont, Font textFont) {
        Paragraph headingParagraph = new Paragraph(heading, headingFont);
        headingParagraph.setSpacingBefore(18);
        headingParagraph.setSpacingAfter(6);
        document.add(headingParagraph);
        document.add(new Paragraph(text, textFont));
    }

    /**
     * Replaces a missing optional value by a dash.
     */
    private static String orDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    /**
     * Maps an evaluation to the representation exposed by the API.
     *
     * @param evaluation evaluation with its appointment, self evaluation, company and ergonomist loaded
     * @return evaluation response
     */
    private static PersonalizedEvaluationResponseDTO toResponse(PersonalizedEvaluation evaluation) {
        SelfEvaluation selfEvaluation = evaluation.getAppointment().getSelfEvaluation();
        return new PersonalizedEvaluationResponseDTO(
                evaluation.getId(),
                evaluation.getAppointment().getId(),
                evaluation.getUser().getId(),
                selfEvaluation.getEmployeeName(),
                evaluation.getDiagnosis(),
                evaluation.getRecommendations(),
                evaluation.getRiskLevel(),
                evaluation.getReportPath(),
                evaluation.getEvaluatedAt(),
                selfEvaluation.getEmployeeEmail(),
                selfEvaluation.getCompany().getBusinessName());
    }
}
