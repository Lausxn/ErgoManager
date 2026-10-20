package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.report.EvaluationReportItemDTO;
import com.mgs.ergomanager.dto.report.ReportCompanyDTO;
import com.mgs.ergomanager.dto.report.ReportEmployeeDTO;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.CompanyNameChange;
import com.mgs.ergomanager.model.Form;
import com.mgs.ergomanager.model.PersonalizedEvaluation;
import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.enums.FormType;
import com.mgs.ergomanager.repository.CompanyNameChangeRepository;
import com.mgs.ergomanager.repository.PersonalizedEvaluationRepository;
import com.mgs.ergomanager.repository.SelfEvaluationRepository;
import com.mgs.ergomanager.security.CurrentUserService;
import com.mgs.ergomanager.service.ReportService;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link ReportService}. The evaluations are filtered
 * and sorted in memory, so the comparison ignores case and accents in the same
 * way on every database. Every evaluation shows the current name of its
 * company, and the company filter also matches the names the company used
 * before, so renaming a client does not hide its older reports.
 */
@Service
public class ReportServiceImpl implements ReportService {

    private static final String SELF_EVALUATION_PATH = "/api/self-evaluations/%d";
    private static final String PERSONALIZED_EVALUATION_PATH = "/api/personalized-evaluations/%d";

    private static final Comparator<EvaluationReportItemDTO> ALPHABETICAL =
            Comparator.comparing((EvaluationReportItemDTO item) -> comparable(item.companyName()))
                    .thenComparing(item -> comparable(item.employeeName()))
                    .thenComparing(item -> comparable(item.employeeEmail()))
                    .thenComparing(EvaluationReportItemDTO::evaluatedAt,
                            Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(EvaluationReportItemDTO::type)
                    .thenComparing(EvaluationReportItemDTO::evaluationId);

    private final SelfEvaluationRepository selfEvaluationRepository;
    private final PersonalizedEvaluationRepository personalizedEvaluationRepository;
    private final CurrentUserService currentUserService;
    private final CompanyNameChangeRepository nameChangeRepository;

    /**
     * Builds the service with its collaborators.
     *
     * @param selfEvaluationRepository         repository of self evaluations
     * @param personalizedEvaluationRepository repository of personalized evaluations
     * @param currentUserService               access to the signed in user
     * @param nameChangeRepository             repository of the names the companies used before
     */
    public ReportServiceImpl(SelfEvaluationRepository selfEvaluationRepository,
                             PersonalizedEvaluationRepository personalizedEvaluationRepository,
                             CurrentUserService currentUserService,
                             CompanyNameChangeRepository nameChangeRepository) {
        this.selfEvaluationRepository = selfEvaluationRepository;
        this.personalizedEvaluationRepository = personalizedEvaluationRepository;
        this.currentUserService = currentUserService;
        this.nameChangeRepository = nameChangeRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<EvaluationReportItemDTO> findEvaluations(String companyName, String employeeEmail, FormType type) {
        List<EvaluationReportItemDTO> items = new ArrayList<>();
        Map<Long, List<String>> previousNames = previousNamesByCompany();
        if (type == null || type == FormType.SELF_EVALUATION) {
            selfEvaluationRepository.findAllForReport().stream()
                    .map(selfEvaluation -> toItem(selfEvaluation, previousNames))
                    .forEach(items::add);
        }
        if (type == null || type == FormType.PERSONALIZED_EVALUATION) {
            // Same rule as the detail and the PDF: an ergonomist only reads their own evaluations.
            Long ownerId = currentUserService.isAdmin() ? null : currentUserService.getCurrentUser().getId();
            personalizedEvaluationRepository.findAllForReport().stream()
                    .filter(evaluation -> ownerId == null || ownerId.equals(evaluation.getUser().getId()))
                    .map(evaluation -> toItem(evaluation, previousNames))
                    .forEach(items::add);
        }
        Predicate<EvaluationReportItemDTO> matches = item -> matchesCompany(item, companyName)
                && contains(item.employeeEmail(), employeeEmail);
        return items.stream().filter(matches).sorted(ALPHABETICAL).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReportCompanyDTO> findCompanies() {
        Map<Long, Company> companies = new LinkedHashMap<>();
        for (SelfEvaluation selfEvaluation : selfEvaluationRepository.findAllForReport()) {
            companies.putIfAbsent(selfEvaluation.getCompany().getId(), selfEvaluation.getCompany());
        }
        Map<Long, List<String>> previousNames = previousNamesByCompany();
        return companies.values().stream()
                .sorted(Comparator.comparing((Company company) -> comparable(company.getBusinessName()))
                        .thenComparing(Company::getId))
                .map(company -> new ReportCompanyDTO(company.getId(), company.getBusinessName(), company.isActive(),
                        previousNames.getOrDefault(company.getId(), List.of())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReportEmployeeDTO> findEmployees(Long companyId) {
        // One row per employee and company, with the name of their latest self evaluation.
        Map<String, SelfEvaluation> latest = new LinkedHashMap<>();
        for (SelfEvaluation selfEvaluation : selfEvaluationRepository.findAllForReport()) {
            if (companyId != null && !companyId.equals(selfEvaluation.getCompany().getId())) {
                continue;
            }
            String key = selfEvaluation.getCompany().getId() + "|" + selfEvaluation.getEmployeeEmail();
            latest.merge(key, selfEvaluation, ReportServiceImpl::newest);
        }
        return latest.values().stream()
                .map(selfEvaluation -> new ReportEmployeeDTO(
                        selfEvaluation.getEmployeeEmail(),
                        selfEvaluation.getEmployeeName(),
                        selfEvaluation.getCompany().getId(),
                        selfEvaluation.getCompany().getBusinessName()))
                .sorted(Comparator.comparing((ReportEmployeeDTO employee) -> comparable(employee.employeeName()))
                        .thenComparing(employee -> comparable(employee.employeeEmail()))
                        .thenComparing(employee -> comparable(employee.companyName())))
                .toList();
    }

    /**
     * Keeps the most recent of two self evaluations.
     *
     * @param first  a self evaluation
     * @param second another self evaluation of the same employee
     * @return the most recent one
     */
    private static SelfEvaluation newest(SelfEvaluation first, SelfEvaluation second) {
        Comparator<SelfEvaluation> bySubmission = Comparator.comparing(SelfEvaluation::getSubmittedAt,
                        Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(SelfEvaluation::getId);
        return bySubmission.compare(first, second) >= 0 ? first : second;
    }

    /**
     * Reads the names every company used before, with a single query.
     *
     * @return previous names by company identifier, the most recent first
     */
    private Map<Long, List<String>> previousNamesByCompany() {
        return nameChangeRepository.findAllByOrderByChangedAtDescIdDesc().stream()
                .collect(Collectors.groupingBy(change -> change.getCompany().getId(),
                        Collectors.mapping(CompanyNameChange::getBusinessName, Collectors.toList())));
    }

    /**
     * Checks whether the current or a previous name of the company of an
     * evaluation contains the company filter. A blank filter matches every
     * evaluation.
     *
     * @param item   report row
     * @param filter value typed by the user, or null
     * @return true when the evaluation passes the company filter
     */
    private static boolean matchesCompany(EvaluationReportItemDTO item, String filter) {
        return contains(item.companyName(), filter)
                || item.previousCompanyNames().stream().anyMatch(name -> contains(name, filter));
    }

    /**
     * Checks whether a text contains a filter, ignoring case and accents. A
     * blank filter matches every text.
     *
     * @param text   value of the evaluation
     * @param filter value typed by the user, or null
     * @return true when the evaluation passes the filter
     */
    private static boolean contains(String text, String filter) {
        if (filter == null || filter.isBlank()) {
            return true;
        }
        return comparable(text).contains(comparable(filter));
    }

    /**
     * Turns a text into the form used to filter and sort: trimmed, without
     * accents and in lower case, so "Ñandú" sorts next to "nandu".
     *
     * @param text text to transform, may be null
     * @return comparable text
     */
    private static String comparable(String text) {
        if (text == null) {
            return "";
        }
        return Normalizer.normalize(text.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
    }

    /**
     * Maps a self evaluation to a report row.
     *
     * @param selfEvaluation self evaluation with its company and form loaded
     * @param previousNames  previous names by company identifier
     * @return report row
     */
    private static EvaluationReportItemDTO toItem(SelfEvaluation selfEvaluation,
                                                  Map<Long, List<String>> previousNames) {
        Form form = selfEvaluation.getForm();
        return new EvaluationReportItemDTO(
                FormType.SELF_EVALUATION,
                selfEvaluation.getId(),
                selfEvaluation.getId(),
                selfEvaluation.getCompany().getId(),
                selfEvaluation.getCompany().getBusinessName(),
                previousNames.getOrDefault(selfEvaluation.getCompany().getId(), List.of()),
                selfEvaluation.getEmployeeName(),
                selfEvaluation.getEmployeeEmail(),
                selfEvaluation.getEmployeePosition(),
                form.getId(),
                form.getTitle(),
                selfEvaluation.getSubmittedAt(),
                selfEvaluation.getRiskLevel(),
                selfEvaluation.getRiskPercentage(),
                null,
                String.format(SELF_EVALUATION_PATH, selfEvaluation.getId()),
                null);
    }

    /**
     * Maps a personalized evaluation to a report row.
     *
     * @param evaluation    evaluation with its appointment, self evaluation, company, ergonomist and form loaded
     * @param previousNames previous names by company identifier
     * @return report row
     */
    private static EvaluationReportItemDTO toItem(PersonalizedEvaluation evaluation,
                                                  Map<Long, List<String>> previousNames) {
        SelfEvaluation selfEvaluation = evaluation.getAppointment().getSelfEvaluation();
        Form form = evaluation.getForm();
        return new EvaluationReportItemDTO(
                FormType.PERSONALIZED_EVALUATION,
                evaluation.getId(),
                selfEvaluation.getId(),
                selfEvaluation.getCompany().getId(),
                selfEvaluation.getCompany().getBusinessName(),
                previousNames.getOrDefault(selfEvaluation.getCompany().getId(), List.of()),
                selfEvaluation.getEmployeeName(),
                selfEvaluation.getEmployeeEmail(),
                selfEvaluation.getEmployeePosition(),
                form == null ? null : form.getId(),
                form == null ? null : form.getTitle(),
                evaluation.getEvaluatedAt(),
                null,
                null,
                evaluation.getUser().getFullName(),
                String.format(PERSONALIZED_EVALUATION_PATH, evaluation.getId()),
                Objects.requireNonNullElse(evaluation.getReportPath(),
                        String.format(PERSONALIZED_EVALUATION_PATH + "/report", evaluation.getId())));
    }
}
