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

        @NotBlank
        @Size(max = 150)
        String title,

        @Size(max = 500)
        String description,

        @NotNull
        @Min(2000)
        Integer publicationYear,

        @NotEmpty
        @Valid
        List<QuestionRequestDTO> questionList) {
}
