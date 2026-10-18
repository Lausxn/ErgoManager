package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.Form;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link Form} entity.
 */
@Repository
public interface FormRepository extends JpaRepository<Form, Long> {

    /**
     * Returns the forms that can currently be answered.
     *
     * @return list of active forms
     */
    List<Form> findByActiveTrue();

    /**
     * Checks whether at least one form is currently active.
     *
     * @return true when an active form exists
     */
    boolean existsByActiveTrue();

    /**
     * Checks whether an active form different from the supplied one exists.
     *
     * @param id identifier of the form that must be ignored
     * @return true when another active form exists
     */
    boolean existsByActiveTrueAndIdNot(Long id);

    /**
     * Returns the forms that can currently be answered, newest first.
     *
     * @return ordered list of active forms
     */
    List<Form> findByActiveTrueOrderByPublicationYearDescCreatedAtDescIdDesc();

    /**
     * Returns every form, newest publication year first, then newest created.
     *
     * @return ordered list of forms
     */
    List<Form> findAllByOrderByPublicationYearDescCreatedAtDescIdDesc();

    /**
     * Returns the forms published for a given year, used by the annual resend.
     *
     * @param publicationYear year the form was published for
     * @return list of forms
     */
    List<Form> findByPublicationYear(Integer publicationYear);

    /**
     * Counts the forms that can currently be answered.
     *
     * @return number of active forms
     */
    long countByActiveTrue();
}