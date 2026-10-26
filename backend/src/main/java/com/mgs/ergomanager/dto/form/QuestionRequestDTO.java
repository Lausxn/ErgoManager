package com.mgs.ergomanager.dto.form;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Question that is sent together with its form.
 *
 * @param id            identifier of an existing question of the form, null for a new question
 * @param statement     text of the question
 * @param questionOrder position of the question inside the form
 * @param optionList    predefined answers of a self evaluation question; empty for a
 *                      personalized evaluation, whose answers are written by the ergonomist
 */
public record QuestionRequestDTO(

        Long id,

        @NotBlank(message = "Este campo es obligatorio.")
        @Size(max = 500, message = "Use un máximo de 500 caracteres.")
        String statement,

        @NotNull(message = "Este campo es obligatorio.")
        @Min(value = 1, message = "El orden debe ser 1 o mayor.")
        Integer questionOrder,

        List<@Valid AnswerOptionRequestDTO> optionList) {

    /** Trims the statement and turns a missing option list into an empty one. */
    public QuestionRequestDTO {
        statement = statement == null ? null : statement.trim();
        optionList = optionList == null ? List.of() : optionList;
    }
}
