package com.mgs.ergomanager.repository;

import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.SelfEvaluation;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Data access operations for the {@link SelfEvaluation} entity.
 */
@Repository
public interface SelfEvaluationRepository extends JpaRepository<SelfEvaluation, Long> {

    /**
     * Returns the self evaluations submitted by the employees of a company,
     * newest first.
     *
     * @param companyId identifier of the company
     * @return ordered list of self evaluations
     */
    List<SelfEvaluation> findByCompanyIdOrderBySubmittedAtDescIdDesc(Long companyId);

    /**
     * Returns the distinct emails of the employees of a company that have
     * submitted a self evaluation.
     *
     * @param companyId identifier of the company
     * @return list of emails
     */
    @Query("select distinct s.employeeEmail from SelfEvaluation s where s.company.id = :companyId")
    List<String> findDistinctEmployeeEmailsByCompanyId(@Param("companyId") Long companyId);

    /**
     * Returns every self evaluation with its company and form, used by the
     * evaluation report, which filters and sorts them.
     *
     * @return list of self evaluations
     */
    @Query("select s from SelfEvaluation s join fetch s.company join fetch s.form")
    List<SelfEvaluation> findAllForReport();

    /**
     * Returns the self evaluations of one company with the company loaded, for
     * the employee list of the reports.
     *
     * @param companyId identifier of the company
     * @return self evaluations of the company
     */
    @Query("select s from SelfEvaluation s join fetch s.company c where c.id = :companyId")
    List<SelfEvaluation> findForReportByCompanyId(@Param("companyId") Long companyId);

    /**
     * Returns every company with at least one self evaluation, without loading
     * the evaluations.
     *
     * @return companies that appear in the reports
     */
    @Query("select distinct c from SelfEvaluation s join s.company c")
    List<Company> findCompaniesWithSelfEvaluations();
}
