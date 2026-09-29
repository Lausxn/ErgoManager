package com.mgs.ergomanager.dto.form;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Data needed to create or update a self evaluation form.
 *
 * @param title           title shown to the employee
 * @param description     short explanation of the purpose of the form
 * @param publicationYear year the form is published for
 * @param questionList    questions that make up the form
 */
public record FormRequestDTO(

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 150, message = "Use un máximo de 150 caracteres.")
        String title,

        @Size(max = 500, message = "Use un máximo de 500 caracteres.")
        String description,

        @NotNull(message = "Este campo es obligatorio.")
        @Min(value = 2000, message = "El año debe ser 2000 o posterior.")
        Integer publicationYear,

        @NotEmpty(message = "Agregue al menos una pregunta.")
        @Valid
        List<QuestionRequestDTO> questionList) {

    /** Trims the texts and turns a blank description into null. */
    public FormRequestDTO {
        title = title == null ? null : title.trim();
        description = description == null || description.isBlank() ? null : description.trim();
    }
}
