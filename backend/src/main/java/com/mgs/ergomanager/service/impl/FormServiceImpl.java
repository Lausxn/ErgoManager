package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.form.FormRequest;
import com.mgs.ergomanager.dto.form.FormResponse;
import com.mgs.ergomanager.repository.FormRepository;
import com.mgs.ergomanager.repository.QuestionRepository;
import com.mgs.ergomanager.service.FormService;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Default implementation of {@link FormService}.
 */
@Service
public class FormServiceImpl implements FormService {

    private final FormRepository formRepository;

    private final QuestionRepository questionRepository;

    /**
     * Builds the service with its repositories.
     *
     * @param formRepository     repository of forms
     * @param questionRepository repository of questions
     */
    public FormServiceImpl(FormRepository formRepository, QuestionRepository questionRepository) {
        this.formRepository = formRepository;
        this.questionRepository = questionRepository;
    }

    @Override
    public List<FormResponse> findAll() {
        // TODO: read every form and map it to FormResponse.
        throw new UnsupportedOperationException("FormService.findAll is not implemented yet");
    }

    @Override
    public List<FormResponse> findActive() {
        // TODO: read the active forms together with their questions.
        throw new UnsupportedOperationException("FormService.findActive is not implemented yet");
    }

    @Override
    public FormResponse findById(Long id) {
        // TODO: read the form or raise ResourceNotFoundException.
        throw new UnsupportedOperationException("FormService.findById is not implemented yet");
    }

    @Override
    public FormResponse create(FormRequest request) {
        // TODO: store the form and its questions in a single transaction.
        throw new UnsupportedOperationException("FormService.create is not implemented yet");
    }

    @Override
    public FormResponse update(Long id, FormRequest request) {
        // TODO: copy the request over the stored form and its questions.
        throw new UnsupportedOperationException("FormService.update is not implemented yet");
    }

    @Override
    public void deactivate(Long id) {
        // TODO: set the active flag to false so past answers stay readable.
        throw new UnsupportedOperationException("FormService.deactivate is not implemented yet");
    }

    @Override
    public void resendAnnually(Long formId, Long companyId) {
        // TODO: notify the employees of the company that the form is open again.
        throw new UnsupportedOperationException("FormService.resendAnnually is not implemented yet");
    }
}
