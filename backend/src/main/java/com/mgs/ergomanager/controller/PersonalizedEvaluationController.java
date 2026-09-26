package com.mgs.ergomanager.controller;

import com.mgs.ergomanager.dto.personalizedevaluation.PersonalizedEvaluationRequestDTO;
import com.mgs.ergomanager.dto.personalizedevaluation.PersonalizedEvaluationResponseDTO;
import com.mgs.ergomanager.service.PersonalizedEvaluationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints of the evaluations written by the ergonomists, including the PDF
 * report delivered to the client company.
 */
@RestController
@RequestMapping("/api/personalized-evaluations")
@Tag(name = "Personalized evaluations", description = "Evaluations written by the ergonomist and PDF reports")
public class PersonalizedEvaluationController {

    private static final String REPORT_FILE_PREFIX = "personalized-evaluation-";

    private final PersonalizedEvaluationService personalizedEvaluationService;

    /**
     * Builds the controller with its service.
     *
     * @param personalizedEvaluationService service that manages the evaluations
     */
    public PersonalizedEvaluationController(PersonalizedEvaluationService personalizedEvaluationService) {
        this.personalizedEvaluationService = personalizedEvaluationService;
    }

    /**
     * Stores the evaluation written after an appointment.
     *
     * @param request data written by the ergonomist
     * @return the stored evaluation
     */
    @PostMapping
    public ResponseEntity<PersonalizedEvaluationResponseDTO> create(
            @Valid @RequestBody PersonalizedEvaluationRequestDTO request) {
        PersonalizedEvaluationResponseDTO created = personalizedEvaluationService.create(request);
        return ResponseEntity.created(URI.create("/api/personalized-evaluations/" + created.id())).body(created);
    }

    /**
     * Returns a single evaluation.
     *
     * @param id identifier of the evaluation
     * @return the evaluation
     */
    @GetMapping("/{id}")
    public ResponseEntity<PersonalizedEvaluationResponseDTO> findById(@PathVariable Long id) {
        return ResponseEntity.ok(personalizedEvaluationService.findById(id));
    }

    /**
     * Returns the evaluations written by an ergonomist.
     *
     * @param userId identifier of the ergonomist
     * @return list of evaluations
     */
    @GetMapping
    public ResponseEntity<List<PersonalizedEvaluationResponseDTO>> findByErgonomist(@RequestParam Long userId) {
        return ResponseEntity.ok(personalizedEvaluationService.findByErgonomist(userId));
    }

    /**
     * Downloads the PDF report of an evaluation.
     *
     * @param id identifier of the evaluation
     * @return content of the generated PDF file
     */
    @GetMapping("/{id}/report")
    public ResponseEntity<byte[]> downloadReport(@PathVariable Long id) {
        byte[] report = personalizedEvaluationService.generateReport(id);
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(REPORT_FILE_PREFIX + id + ".pdf")
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(MediaType.APPLICATION_PDF)
                .body(report);
    }
}
