package com.mgs.ergomanager.dto.form;

import com.mgs.ergomanager.model.enums.FormType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Data needed to create or update a self evaluation or personalized evaluation form.
 *
 * @param title           name used to recognize the form
 * @param description     short explanation of the purpose of the form
 * @param publicationYear year the form is published for
 * @param type            self evaluation or personalized evaluation; it cannot change after creation
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

        @NotNull(message = "Seleccione el tipo de formulario.")
        FormType type,

        @NotEmpty(message = "Agregue al menos una pregunta.")
        @Size(max = 100, message = "Use un máximo de 100 preguntas.")
        @Valid
        List<QuestionRequestDTO> questionList) {

    /** Trims the texts and turns a blank description into null. */
    public FormRequestDTO {
        title = title == null ? null : title.trim();
        description = description == null || description.isBlank() ? null : description.trim();
    }
}
