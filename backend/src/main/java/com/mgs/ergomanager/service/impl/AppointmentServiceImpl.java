package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.appointment.AppointmentRequest;
import com.mgs.ergomanager.dto.appointment.AppointmentResponse;
import com.mgs.ergomanager.dto.appointment.AvailabilityRequest;
import com.mgs.ergomanager.dto.appointment.AvailabilityResponse;
import com.mgs.ergomanager.repository.AppointmentRepository;
import com.mgs.ergomanager.repository.AvailabilityRepository;
import com.mgs.ergomanager.service.AppointmentService;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Default implementation of {@link AppointmentService}.
 */
@Service
public class AppointmentServiceImpl implements AppointmentService {

    private final AvailabilityRepository availabilityRepository;

    private final AppointmentRepository appointmentRepository;

    /**
     * Builds the service with its repositories.
     *
     * @param availabilityRepository repository of published time slots
     * @param appointmentRepository  repository of booked appointments
     */
    public AppointmentServiceImpl(AvailabilityRepository availabilityRepository,
                                  AppointmentRepository appointmentRepository) {
        this.availabilityRepository = availabilityRepository;
        this.appointmentRepository = appointmentRepository;
    }

    @Override
    public AvailabilityResponse createAvailability(AvailabilityRequest request) {
        // TODO: reject a slot that overlaps another one of the same ergonomist.
        throw new UnsupportedOperationException("AppointmentService.createAvailability is not implemented yet");
    }

    @Override
    public List<AvailabilityResponse> findFreeAvailabilities(Long userId, LocalDateTime from, LocalDateTime to) {
        // TODO: read the free slots inside the range.
        throw new UnsupportedOperationException("AppointmentService.findFreeAvailabilities is not implemented yet");
    }

    @Override
    public AppointmentResponse book(AppointmentRequest request) {
        // TODO: mark the slot as taken and create the appointment.
        throw new UnsupportedOperationException("AppointmentService.book is not implemented yet");
    }

    @Override
    public List<AppointmentResponse> findAgenda(Long userId, LocalDateTime from, LocalDateTime to) {
        // TODO: read the appointments of the ergonomist inside the range.
        throw new UnsupportedOperationException("AppointmentService.findAgenda is not implemented yet");
    }

    @Override
    public AppointmentResponse cancel(Long id) {
        // TODO: set the status to CANCELLED and free the slot again.
        throw new UnsupportedOperationException("AppointmentService.cancel is not implemented yet");
    }
}
