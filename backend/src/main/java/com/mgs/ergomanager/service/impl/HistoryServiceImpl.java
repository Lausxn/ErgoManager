package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.history.HistoryResponseDTO;
import com.mgs.ergomanager.repository.HistoryRepository;
import com.mgs.ergomanager.service.HistoryService;
import java.util.List;
import org.springframework.stereotype.Service;

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
    public List<HistoryResponseDTO> findByCompany(Long companyId) {
        // TODO: read the entries of the company and map them to HistoryResponseDTO.
        throw new UnsupportedOperationException("HistoryService.findByCompany is not implemented yet");
    }

    @Override
    public List<HistoryResponseDTO> findByEmployee(String employeeEmail) {
        // TODO: read the entries of the employee and map them to HistoryResponseDTO.
        throw new UnsupportedOperationException("HistoryService.findByEmployee is not implemented yet");
    }
}
