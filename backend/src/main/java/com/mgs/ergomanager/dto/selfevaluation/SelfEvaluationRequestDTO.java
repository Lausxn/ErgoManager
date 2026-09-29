package com.mgs.ergomanager.dto.selfevaluation;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Locale;

/**
 * Self evaluation submitted by an employee of a client company.
 *
 * @param formId           identifier of the answered form
 * @param companyId        identifier of the company the employee works for
 * @param employeeName     full name of the employee
 * @param employeeEmail    email used to contact the employee
 * @param employeePosition job position of the employee
 * @param answerList       answers given to every question of the form
 */
public record SelfEvaluationRequestDTO(

        @NotNull(message = "Este campo es obligatorio.")
        Long formId,

        @NotNull(message = "Este campo es obligatorio.")
        Long companyId,

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 150, message = "Use un máximo de 150 caracteres.")
        String employeeName,

        @NotBlank(message = "Este campo es obligatorio.")
        @Email(message = "Escriba un correo válido.")
        @Size(max = 120, message = "Use un máximo de 120 caracteres.")
        String employeeEmail,

        @Size(max = 100, message = "Use un máximo de 100 caracteres.")
        String employeePosition,

        @NotEmpty(message = "Responda todas las preguntas del formulario.")
        @Valid
        List<AnswerRequestDTO> answerList) {

    /** Trims the employee data, lowercases the email and turns a blank position into null. */
    public SelfEvaluationRequestDTO {
        employeeName = employeeName == null ? null : employeeName.trim();
        employeeEmail = employeeEmail == null ? null : employeeEmail.trim().toLowerCase(Locale.ROOT);
        employeePosition = employeePosition == null || employeePosition.isBlank() ? null : employeePosition.trim();
    }
}
