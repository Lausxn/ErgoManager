package com.mgs.ergomanager.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.mgs.ergomanager.hu.UserStories;
import com.mgs.ergomanager.model.AnswerOption;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.Question;
import com.mgs.ergomanager.model.enums.FormType;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Storage of the form types and of the weighted answer options. */
@Tag(UserStories.HU_009)
class FormModelPersistenceTests extends ApiIntegrationTestSupport {

    @Autowired
    private EntityManager entityManager;

    private AnswerOption persistOption(Question question, String label, int weight, int order, boolean active) {
        AnswerOption option = new AnswerOption();
        option.setQuestion(question);
        option.setLabel(label);
        option.setWeight(weight);
        option.setOptionOrder(order);
        option.setActive(active);
        return answerOptionRepository.saveAndFlush(option);
    }

    private Question persistQuestion(Form form, int order) {
        Question question = new Question();
        question.setForm(form);
        question.setStatement("Pregunta " + order);
        question.setQuestionOrder(order);
        return questionRepository.saveAndFlush(question);
    }

    @Test
    void newFormsAreSelfEvaluationsUnlessAnotherTypeIsSet() {
        Form selfEvaluation = persistForm("Autoevaluación", 1);
        Form personalized = new Form();
        personalized.setTitle("Evaluación personalizada");
        personalized.setPublicationYear(2026);
        personalized.setType(FormType.PERSONALIZED_EVALUATION);
        formRepository.saveAndFlush(personalized);
        entityManager.clear();

        assertThat(formRepository.findById(selfEvaluation.getId()).orElseThrow().getType())
                .isEqualTo(FormType.SELF_EVALUATION);
        assertThat(formRepository.findById(personalized.getId()).orElseThrow().getType())
                .isEqualTo(FormType.PERSONALIZED_EVALUATION);
    }

    @Test
    void formsStoredBeforeTheTypeExistedAreReadAsSelfEvaluations() {
        Form form = persistForm("Formulario anterior", 1);
        entityManager.createNativeQuery("UPDATE forms SET form_type = NULL WHERE id = :id")
                .setParameter("id", form.getId())
                .executeUpdate();
        entityManager.clear();

        assertThat(formRepository.findById(form.getId()).orElseThrow().getType())
                .isEqualTo(FormType.SELF_EVALUATION);
    }

    @Test
    void returnsTheActiveOptionsOfSeveralQuestionsInOrder() {
        Form form = persistForm("Autoevaluación");
        Question first = persistQuestion(form, 1);
        Question second = persistQuestion(form, 2);
        persistOption(first, "Siempre", 3, 2, true);
        persistOption(first, "Nunca", 1, 1, true);
        persistOption(first, "Retirada", 2, 3, false);
        persistOption(second, "Sí", 3, 1, true);

        List<AnswerOption> active = answerOptionRepository
                .findByQuestionIdInAndActiveTrueOrderByOptionOrderAsc(List.of(first.getId(), second.getId()));

        assertThat(active).extracting(AnswerOption::getLabel).containsExactlyInAnyOrder("Nunca", "Siempre", "Sí");
        assertThat(active).filteredOn(option -> option.getQuestion().getId().equals(first.getId()))
                .extracting(AnswerOption::getLabel, AnswerOption::getWeight)
                .containsExactly(tuple("Nunca", 1), tuple("Siempre", 3));
        assertThat(answerOptionRepository.findByQuestionIdIn(List.of(first.getId())))
                .extracting(AnswerOption::getLabel)
                .containsExactlyInAnyOrder("Nunca", "Siempre", "Retirada");
    }
}
