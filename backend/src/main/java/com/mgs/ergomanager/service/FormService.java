package com.mgs.ergomanager.service;

import com.mgs.ergomanager.dto.form.FormRequestDTO;
import com.mgs.ergomanager.dto.form.FormResponseDTO;
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
    List<FormResponseDTO> findAll();

    /**
     * Returns the forms that can currently be answered.
     *
     * @return list of active forms
     */
    List<FormResponseDTO> findActive();

    /**
     * Returns a single form with its questions.
     *
     * @param id identifier of the form
     * @return the form
     */
    FormResponseDTO findById(Long id);

    /**
     * Creates a form together with its questions.
     *
     * @param request data of the form
     * @return the created form
     */
    FormResponseDTO create(FormRequestDTO request);

    /**
     * Updates a form and its questions.
     *
     * @param id      identifier of the form
     * @param request new data of the form
     * @return the updated form
     */
    FormResponseDTO update(Long id, FormRequestDTO request);

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
