package com.mgs.ergomanager.controller;

import com.mgs.ergomanager.dto.selfevaluation.SelfEvaluationRequest;
import com.mgs.ergomanager.dto.selfevaluation.SelfEvaluationResponse;
import com.mgs.ergomanager.service.SelfEvaluationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints of the self evaluation filled in by the employees. Submitting a
 * self evaluation is public; reading them requires an authenticated user.
 */
@RestController
@RequestMapping("/api/self-evaluations")
@Tag(name = "Self evaluations", description = "Forms answered by the employees and their risk level")
public class SelfEvaluationController {

    private final SelfEvaluationService selfEvaluationService;

    /**
     * Builds the controller with its service.
     *
     * @param selfEvaluationService service that manages the self evaluations
     */
    public SelfEvaluationController(SelfEvaluationService selfEvaluationService) {
        this.selfEvaluationService = selfEvaluationService;
    }

    /**
     * Stores a self evaluation and returns its calculated risk level.
     *
     * @param request answers sent by the employee
     * @return the stored self evaluation
     */
    @PostMapping
    public ResponseEntity<SelfEvaluationResponse> submit(@Valid @RequestBody SelfEvaluationRequest request) {
        SelfEvaluationResponse created = selfEvaluationService.submit(request);
        return ResponseEntity.created(URI.create("/api/self-evaluations/" + created.id())).body(created);
    }

    /**
     * Returns a single self evaluation with its answers.
     *
     * @param id identifier of the self evaluation
     * @return the self evaluation
     */
    @GetMapping("/{id}")
    public ResponseEntity<SelfEvaluationResponse> findById(@PathVariable Long id) {
        return ResponseEntity.ok(selfEvaluationService.findById(id));
    }

    /**
     * Returns the self evaluations submitted by the employees of a company.
     *
     * @param companyId identifier of the company
     * @return list of self evaluations
     */
    @GetMapping
    public ResponseEntity<List<SelfEvaluationResponse>> findByCompany(@RequestParam Long companyId) {
        return ResponseEntity.ok(selfEvaluationService.findByCompany(companyId));
    }
}
