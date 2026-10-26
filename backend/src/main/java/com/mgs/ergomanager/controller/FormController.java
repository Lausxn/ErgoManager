package com.mgs.ergomanager.controller;

import com.mgs.ergomanager.dto.form.FormRequestDTO;
import com.mgs.ergomanager.dto.form.FormResendResponseDTO;
import com.mgs.ergomanager.dto.form.FormResponseDTO;
import com.mgs.ergomanager.model.enums.FormType;
import com.mgs.ergomanager.service.FormInvitationService;
import com.mgs.ergomanager.service.FormService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints used to manage the self evaluation and personalized evaluation
 * forms. Only the list of active forms is public, because the employees answer
 * them without an account.
 */
@RestController
@RequestMapping("/api/forms")
@Tag(name = "Forms", description = "Management of the self evaluation and personalized evaluation forms")
public class FormController {

    private final FormService formService;
    private final FormInvitationService formInvitationService;

    /**
     * Builds the controller with its services.
     *
     * @param formService           service that manages the forms
     * @param formInvitationService service that emails the forms to the companies
     */
    public FormController(FormService formService, FormInvitationService formInvitationService) {
        this.formService = formService;
        this.formInvitationService = formInvitationService;
    }

    /**
     * Returns every form, active or not, optionally of a single type.
     *
     * @param type SELF_EVALUATION or PERSONALIZED_EVALUATION; every type when missing
     * @return list of forms
     */
    @GetMapping
    public ResponseEntity<List<FormResponseDTO>> findAll(@RequestParam(required = false) FormType type) {
        return ResponseEntity.ok(formService.findAll(type));
    }

    /**
     * Returns the active self evaluation forms that the employees answer. It is
     * public and hides the weights of the answers.
     *
     * @return list of active self evaluation forms
     */
    @GetMapping("/active")
    public ResponseEntity<List<FormResponseDTO>> findActive() {
        return ResponseEntity.ok(formService.findActive());
    }

    /**
     * Returns the active personalized evaluation form filled in by the ergonomist.
     *
     * @return the active personalized evaluation form, or HTTP 404 when there is none
     */
    @GetMapping("/personalized/active")
    public ResponseEntity<FormResponseDTO> findActivePersonalized() {
        return ResponseEntity.ok(formService.findActivePersonalized());
    }

    /**
     * Returns a single form with its questions.
     *
     * @param id identifier of the form
     * @return the form
     */
    @GetMapping("/{id}")
    public ResponseEntity<FormResponseDTO> findById(@PathVariable Long id) {
        return ResponseEntity.ok(formService.findById(id));
    }

    /**
     * Creates a form together with its questions as an inactive draft.
     *
     * @param request data of the form
     * @return the created form
     */
    @PostMapping
    public ResponseEntity<FormResponseDTO> create(@Valid @RequestBody FormRequestDTO request) {
        FormResponseDTO created = formService.create(request);
        return ResponseEntity.created(URI.create("/api/forms/" + created.id())).body(created);
    }

    /**
     * Updates a form and its questions.
     *
     * @param id      identifier of the form
     * @param request new data of the form
     * @return the updated form
     */
    @PutMapping("/{id}")
    public ResponseEntity<FormResponseDTO> update(@PathVariable Long id, @Valid @RequestBody FormRequestDTO request) {
        return ResponseEntity.ok(formService.update(id, request));
    }

    /**
     * Deactivates a form so it is no longer offered to the employees.
     *
     * @param id identifier of the form
     * @return empty response with HTTP status 204
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        formService.deactivate(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Activates a draft or deactivated form, when no other form of the same type
     * is active and the form is complete.
     *
     * @param id identifier of the form
     * @return the activated form
     */
    @PatchMapping("/{id}/activate")
    public ResponseEntity<FormResponseDTO> activate(@PathVariable Long id) {
        return ResponseEntity.ok(formService.activate(id));
    }

    /**
     * Sends a form again to the employees of a company, as the yearly follow up.
     *
     * @param id        identifier of the form to resend
     * @param companyId identifier of the company to notify
     * @return number of emails sent, with HTTP status 202
     */
    @PostMapping("/{id}/resend/{companyId}")
    public ResponseEntity<FormResendResponseDTO> resendAnnually(@PathVariable Long id,
                                                                @PathVariable Long companyId) {
        return ResponseEntity.accepted().body(formInvitationService.resendAnnually(id, companyId));
    }
}
