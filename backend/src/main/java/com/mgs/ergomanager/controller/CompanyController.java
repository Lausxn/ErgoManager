package com.mgs.ergomanager.controller;

import com.mgs.ergomanager.dto.company.CompanyRequestDTO;
import com.mgs.ergomanager.dto.company.CompanyResponseDTO;
import com.mgs.ergomanager.service.CompanyService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints used by the administrator to manage the client companies.
 */
@RestController
@RequestMapping("/api/companies")
@Tag(name = "Companies", description = "Management of the client companies")
public class CompanyController {

    private final CompanyService companyService;

    /**
     * Builds the controller with its service.
     *
     * @param companyService service that manages the companies
     */
    public CompanyController(CompanyService companyService) {
        this.companyService = companyService;
    }

    /**
     * Returns every registered company.
     *
     * @return list of companies
     */
    @GetMapping
    public ResponseEntity<List<CompanyResponseDTO>> findAll() {
        return ResponseEntity.ok(companyService.findAll());
    }

    /**
     * Returns a single company.
     *
     * @param id identifier of the company
     * @return the company
     */
    @GetMapping("/{id}")
    public ResponseEntity<CompanyResponseDTO> findById(@PathVariable Long id) {
        return ResponseEntity.ok(companyService.findById(id));
    }

    /**
     * Registers a new company.
     *
     * @param request data of the company
     * @return the created company
     */
    @PostMapping
    public ResponseEntity<CompanyResponseDTO> create(@Valid @RequestBody CompanyRequestDTO request) {
        CompanyResponseDTO created = companyService.create(request);
        return ResponseEntity.created(URI.create("/api/companies/" + created.id())).body(created);
    }

    /**
     * Updates the data of an existing company.
     *
     * @param id      identifier of the company
     * @param request new data of the company
     * @return the updated company
     */
    @PutMapping("/{id}")
    public ResponseEntity<CompanyResponseDTO> update(@PathVariable Long id,
                                                  @Valid @RequestBody CompanyRequestDTO request) {
        return ResponseEntity.ok(companyService.update(id, request));
    }

    /**
     * Deactivates a company without deleting its evaluation history.
     *
     * @param id identifier of the company
     * @return empty response with HTTP status 204
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        companyService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
