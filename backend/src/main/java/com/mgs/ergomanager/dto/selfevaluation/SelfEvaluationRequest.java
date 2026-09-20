package com.mgs.ergomanager.dto.selfevaluation;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

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
public record SelfEvaluationRequest(

        @NotNull
        Long formId,

        @NotNull
        Long companyId,

        @NotBlank
        @Size(max = 150)
        String employeeName,

        @NotBlank
        @Email
        @Size(max = 120)
        String employeeEmail,

        @Size(max = 100)
        String employeePosition,

        @NotEmpty
        @Valid
        List<AnswerRequest> answerList) {
}
