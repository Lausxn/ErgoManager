package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.model.enums.HistoryType;
import com.mgs.ergomanager.dto.appointment.AppointmentRequestDTO;
import com.mgs.ergomanager.dto.appointment.AppointmentResponseDTO;
import com.mgs.ergomanager.dto.appointment.AvailabilityRequestDTO;
import com.mgs.ergomanager.dto.appointment.AvailabilityResponseDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.Appointment;
import com.mgs.ergomanager.model.Availability;
import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.AppointmentStatus;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.AppointmentRepository;
import com.mgs.ergomanager.repository.AvailabilityRepository;
import com.mgs.ergomanager.repository.HistoryRepository;
import com.mgs.ergomanager.repository.PersonalizedEvaluationRepository;
import com.mgs.ergomanager.repository.SelfEvaluationRepository;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.security.CurrentUserService;
import com.mgs.ergomanager.service.AppointmentService;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link AppointmentService}. An administrator works
 * with every agenda; an ergonomist only with their own.
 */
@Service
public class AppointmentServiceImpl implements AppointmentService {

    /** States of an appointment that still has to be attended. */
    static final List<AppointmentStatus> PENDING_STATUSES =
            List.of(AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED);

    private static final DateTimeFormatter HISTORY_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private static final String APPOINTMENT_NOT_FOUND_MESSAGE = "No se encontró la cita.";

    private final AvailabilityRepository availabilityRepository;

    private final AppointmentRepository appointmentRepository;

    private final UserRepository userRepository;

    private final SelfEvaluationRepository selfEvaluationRepository;

    private final PersonalizedEvaluationRepository personalizedEvaluationRepository;

    private final HistoryRepository historyRepository;

    private final CurrentUserService currentUserService;

    /**
     * Builds the service with its collaborators.
     *
     * @param availabilityRepository           repository of published time slots
     * @param appointmentRepository            repository of booked appointments
     * @param userRepository                   repository of application users
     * @param selfEvaluationRepository         repository of self evaluations
     * @param personalizedEvaluationRepository repository of personalized evaluations
     * @param historyRepository                repository of history entries
     * @param currentUserService               access to the signed in user
     */
    public AppointmentServiceImpl(AvailabilityRepository availabilityRepository,
                                  AppointmentRepository appointmentRepository,
                                  UserRepository userRepository,
                                  SelfEvaluationRepository selfEvaluationRepository,
                                  PersonalizedEvaluationRepository personalizedEvaluationRepository,
                                  HistoryRepository historyRepository,
                                  CurrentUserService currentUserService) {
        this.availabilityRepository = availabilityRepository;
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
        this.selfEvaluationRepository = selfEvaluationRepository;
        this.personalizedEvaluationRepository = personalizedEvaluationRepository;
        this.historyRepository = historyRepository;
        this.currentUserService = currentUserService;
    }

    @Override
    @Transactional
    public AvailabilityResponseDTO createAvailability(AvailabilityRequestDTO request) {
        currentUserService.checkOwnerOrAdmin(request.userId());
        User ergonomist = userRepository.findById(request.userId())
                .filter(user -> user.isActive() && user.getRole() == Role.ERGONOMIST)
                .orElseThrow(() -> new BusinessException("El usuario seleccionado no es un ergónomo activo."));
        if (!request.endDateTime().isAfter(request.startDateTime())) {
            throw new BusinessException("La hora de fin debe ser posterior a la de inicio.");
        }
        if (availabilityRepository.existsByUserIdAndStartDateTimeBeforeAndEndDateTimeAfter(
                ergonomist.getId(), request.endDateTime(), request.startDateTime())) {
            throw new DuplicateResourceException("Ya tiene una disponibilidad que se cruza con ese horario.");
        }

        Availability availability = new Availability();
        availability.setUser(ergonomist);
        availability.setStartDateTime(request.startDateTime());
        availability.setEndDateTime(request.endDateTime());
        availability.setTaken(false);
        return toAvailabilityResponse(availabilityRepository.save(availability));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AvailabilityResponseDTO> findFreeAvailabilities(Long userId, LocalDateTime from, LocalDateTime to) {
        currentUserService.checkOwnerOrAdmin(userId);
        return availabilityRepository
                .findByUserIdAndTakenFalseAndStartDateTimeBetweenOrderByStartDateTimeAsc(userId, from, to)
                .stream()
                .map(AppointmentServiceImpl::toAvailabilityResponse)
                .toList();
    }

    @Override
    @Transactional
    public void deleteAvailability(Long id) {
        Availability availability = availabilityRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró la disponibilidad."));
        currentUserService.checkOwnerOrAdmin(availability.getUser().getId());
        if (availability.isTaken()) {
            throw new BusinessException("No se puede eliminar un espacio que ya tiene una cita.");
        }
        // Cancelled appointments may still point to the slot.
        appointmentRepository.detachAvailability(id);
        availabilityRepository.deleteById(id);
    }

    @Override
    @Transactional
    public AppointmentResponseDTO book(AppointmentRequestDTO request) {
        SelfEvaluation selfEvaluation = selfEvaluationRepository.findById(request.selfEvaluationId())
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró la autoevaluación."));
        Availability availability = availabilityRepository.findByIdForUpdate(request.availabilityId())
                .orElseThrow(() -> new BusinessException("El espacio seleccionado no existe."));
        User ergonomist = availability.getUser();
        currentUserService.checkOwnerOrAdmin(ergonomist.getId());
        if (availability.isTaken()) {
            throw new BusinessException("El espacio seleccionado ya fue reservado. Elija otro horario.");
        }
        if (!availability.getStartDateTime().isAfter(LocalDateTime.now())) {
            throw new BusinessException("El espacio seleccionado ya pasó. Elija otro horario.");
        }
        if (appointmentRepository.existsBySelfEvaluationIdAndStatusIn(selfEvaluation.getId(), PENDING_STATUSES)) {
            throw new DuplicateResourceException("Este colaborador ya tiene una cita pendiente.");
        }

        Appointment appointment = new Appointment();
        appointment.setSelfEvaluation(selfEvaluation);
        appointment.setUser(ergonomist);
        appointment.setAvailability(availability);
        appointment.setStartDateTime(availability.getStartDateTime());
        appointment.setEndDateTime(availability.getEndDateTime());
        appointment.setStatus(AppointmentStatus.SCHEDULED);
        appointment.setNotes(request.notes());
        availability.setTaken(true);

        Appointment saved = appointmentRepository.save(appointment);
        historyRepository.save(HistoryEntries.of(HistoryType.APPOINTMENT_BOOKED, selfEvaluation, null,
                "Cita agendada para el " + HISTORY_DATE_FORMAT.format(saved.getStartDateTime())
                        + " con " + ergonomist.getFullName() + "."));
        return toResponse(saved, false);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AppointmentResponseDTO> findAgenda(Long userId, LocalDateTime from, LocalDateTime to) {
        currentUserService.checkOwnerOrAdmin(userId);
        List<Appointment> appointments = appointmentRepository.findAgenda(userId, from, to);
        if (appointments.isEmpty()) {
            return List.of();
        }
        Set<Long> evaluated = new HashSet<>(personalizedEvaluationRepository
                .findEvaluatedAppointmentIds(appointments.stream().map(Appointment::getId).toList()));
        return appointments.stream()
                .map(appointment -> toResponse(appointment, evaluated.contains(appointment.getId())))
                .toList();
    }

    @Override
    @Transactional
    public AppointmentResponseDTO cancel(Long id) {
        Appointment appointment = appointmentRepository.findDetailedById(id)
                .orElseThrow(() -> new ResourceNotFoundException(APPOINTMENT_NOT_FOUND_MESSAGE));
        currentUserService.checkOwnerOrAdmin(appointment.getUser().getId());
        if (!PENDING_STATUSES.contains(appointment.getStatus())) {
            throw new BusinessException("Solo se pueden cancelar citas programadas o confirmadas.");
        }
        appointment.setStatus(AppointmentStatus.CANCELLED);
        if (appointment.getAvailability() != null) {
            appointment.getAvailability().setTaken(false);
        }
        historyRepository.save(HistoryEntries.of(HistoryType.APPOINTMENT_CANCELLED, appointment.getSelfEvaluation(), null, "Cita cancelada."));
        return toResponse(appointmentRepository.save(appointment),
                personalizedEvaluationRepository.existsByAppointmentId(id));
    }

    /**
     * Maps a slot to the representation exposed by the API.
     *
     * @param availability stored slot, with its ergonomist loaded
     * @return slot response
     */
    private static AvailabilityResponseDTO toAvailabilityResponse(Availability availability) {
        return new AvailabilityResponseDTO(
                availability.getId(),
                availability.getUser().getId(),
                availability.getUser().getFullName(),
                availability.getStartDateTime(),
                availability.getEndDateTime(),
                availability.isTaken());
    }

    /**
     * Maps an appointment to the representation exposed by the API.
     *
     * @param appointment stored appointment, with self evaluation, company and ergonomist loaded
     * @param evaluated   true when a personalized evaluation exists for it
     * @return appointment response
     */
    static AppointmentResponseDTO toResponse(Appointment appointment, boolean evaluated) {
        SelfEvaluation selfEvaluation = appointment.getSelfEvaluation();
        return new AppointmentResponseDTO(
                appointment.getId(),
                selfEvaluation.getId(),
                appointment.getUser().getId(),
                selfEvaluation.getEmployeeName(),
                appointment.getStartDateTime(),
                appointment.getEndDateTime(),
                appointment.getStatus(),
                appointment.getNotes(),
                selfEvaluation.getEmployeeEmail(),
                selfEvaluation.getCompany().getId(),
                selfEvaluation.getCompany().getBusinessName(),
                appointment.getUser().getFullName(),
                evaluated);
    }
}
