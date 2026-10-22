package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.history.HistoryResponseDTO;
import com.mgs.ergomanager.model.History;
import com.mgs.ergomanager.repository.HistoryRepository;
import com.mgs.ergomanager.service.HistoryService;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link HistoryService}.
 */
@Service
public class HistoryServiceImpl implements HistoryService {

    private final HistoryRepository historyRepository;

    /**
     * Builds the service with its repository.
     *
     * @param historyRepository repository of history entries
     */
    public HistoryServiceImpl(HistoryRepository historyRepository) {
        this.historyRepository = historyRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<HistoryResponseDTO> findByCompany(Long companyId) {
        return historyRepository.findByCompanyIdOrderByRegisteredAtDescIdDesc(companyId).stream()
                .map(HistoryServiceImpl::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<HistoryResponseDTO> findByEmployee(String employeeEmail) {
        String normalizedEmail = employeeEmail == null ? "" : employeeEmail.trim().toLowerCase(Locale.ROOT);
        return historyRepository.findByEmployeeEmailOrderByRegisteredAtDescIdDesc(normalizedEmail).stream()
                .map(HistoryServiceImpl::toResponse)
                .toList();
    }

    /**
     * Maps a history entry to the representation exposed by the API. The
     * linked evaluations are lazy proxies; reading their identifier does not
     * trigger a query.
     *
     * @param history stored entry, with its company loaded
     * @return history response
     */
    private static HistoryResponseDTO toResponse(History history) {
        return new HistoryResponseDTO(
                history.getId(),
                history.getCompany().getId(),
                history.getSelfEvaluation() == null ? null : history.getSelfEvaluation().getId(),
                history.getPersonalizedEvaluation() == null ? null : history.getPersonalizedEvaluation().getId(),
                history.getEmployeeEmail(),
                history.getDescription(),
                history.getRegisteredAt(),
                history.getCompany().getBusinessName(),
                history.getType());
    }
}
