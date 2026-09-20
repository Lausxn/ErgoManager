package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.form.FormRequest;
import com.mgs.ergomanager.dto.form.FormResponse;
import java.util.List;

/**
 * Management of the self evaluation forms and their annual resend.
 */
public interface FormService {

    /**
     * Returns every form, active or not.
     *
     * @return list of forms
     */
    List<FormResponse> findAll();

    /**
     * Returns the forms that can currently be answered.
     *
     * @return list of active forms
     */
    List<FormResponse> findActive();

    /**
     * Returns a single form with its questions.
     *
     * @param id identifier of the form
     * @return the form
     */
    FormResponse findById(Long id);

    /**
     * Creates a form together with its questions.
     *
     * @param request data of the form
     * @return the created form
     */
    FormResponse create(FormRequest request);

    /**
     * Updates a form and its questions.
     *
     * @param id      identifier of the form
     * @param request new data of the form
     * @return the updated form
     */
    FormResponse update(Long id, FormRequest request);

    /**
     * Deactivates a form so it is no longer offered to the employees.
     *
     * @param id identifier of the form
     */
    void deactivate(Long id);

    /**
     * Sends a form again to the employees of a company, which is the yearly
     * follow up required by MGS.
     *
     * @param formId    identifier of the form to resend
     * @param companyId identifier of the company to notify
     */
    void resendAnnually(Long formId, Long companyId);
}
