package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.dashboard.DashboardSummaryDTO;
import com.mgs.ergomanager.repository.AppointmentRepository;
import com.mgs.ergomanager.repository.CompanyRepository;
import com.mgs.ergomanager.repository.FormRepository;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.service.DashboardService;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link DashboardService}. Every counter is a count
 * query, so no list is loaded into memory.
 */
@Service
public class DashboardServiceImpl implements DashboardService {

    private final AppointmentRepository appointmentRepository;
    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final FormRepository formRepository;

    /**
     * Builds the service with its repositories.
     *
     * @param appointmentRepository repository of appointments
     * @param companyRepository     repository of client companies
     * @param userRepository        repository of application users
     * @param formRepository        repository of forms
     */
    public DashboardServiceImpl(AppointmentRepository appointmentRepository,
                                CompanyRepository companyRepository,
                                UserRepository userRepository,
                                FormRepository formRepository) {
        this.appointmentRepository = appointmentRepository;
        this.companyRepository = companyRepository;
        this.userRepository = userRepository;
        this.formRepository = formRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public DashboardSummaryDTO getSummary() {
        return new DashboardSummaryDTO(
                appointmentRepository.countByStatusInAndStartDateTimeGreaterThanEqual(
                        AppointmentServiceImpl.PENDING_STATUSES, LocalDateTime.now()),
                companyRepository.countByActiveTrue(),
                userRepository.countByActiveTrue(),
                formRepository.countByActiveTrue());
    }
}
