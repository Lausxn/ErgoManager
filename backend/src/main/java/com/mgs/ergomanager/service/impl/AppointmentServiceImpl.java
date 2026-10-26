package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.appointment.AppointmentRequestDTO;
import com.mgs.ergomanager.dto.appointment.AppointmentRescheduleRequestDTO;
import com.mgs.ergomanager.dto.appointment.AppointmentResponseDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.Appointment;
import com.mgs.ergomanager.model.Availability;
import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.AppointmentStatus;
import com.mgs.ergomanager.model.enums.HistoryType;
import com.mgs.ergomanager.repository.AppointmentRepository;
import com.mgs.ergomanager.repository.AvailabilityRepository;
import com.mgs.ergomanager.repository.HistoryRepository;
import com.mgs.ergomanager.repository.PersonalizedEvaluationRepository;
import com.mgs.ergomanager.repository.SelfEvaluationRepository;
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

    private static final DateTimeFormatter HISTORY_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final String APPOINTMENT_NOT_FOUND_MESSAGE = "No se encontró la cita.";
    private static final String MISSING_SLOT_MESSAGE = "El espacio seleccionado no existe.";
    private final AvailabilityRepository availabilityRepository;
    private final AppointmentRepository appointmentRepository;
    private final SelfEvaluationRepository selfEvaluationRepository;
    private final PersonalizedEvaluationRepository personalizedEvaluationRepository;
    private final HistoryRepository historyRepository;
    private final CurrentUserService currentUserService;

    /**
     * Builds the service with its collaborators.
     *
     * @param availabilityRepository           repository of published time slots
     * @param appointmentRepository            repository of booked appointments
     * @param selfEvaluationRepository         repository of self evaluations
     * @param personalizedEvaluationRepository repository of personalized evaluations
     * @param historyRepository                repository of history entries
     * @param currentUserService               access to the signed in user
     */
    public AppointmentServiceImpl(AvailabilityRepository availabilityRepository,
                                  AppointmentRepository appointmentRepository,
                                  SelfEvaluationRepository selfEvaluationRepository,
                                  PersonalizedEvaluationRepository personalizedEvaluationRepository,
                                  HistoryRepository historyRepository,
                                  CurrentUserService currentUserService) {
        this.availabilityRepository = availabilityRepository;
        this.appointmentRepository = appointmentRepository;
        this.selfEvaluationRepository = selfEvaluationRepository;
        this.personalizedEvaluationRepository = personalizedEvaluationRepository;
        this.historyRepository = historyRepository;
        this.currentUserService = currentUserService;
    }

    @Override
    @Transactional
    public AppointmentResponseDTO book(AppointmentRequestDTO request) {
        SelfEvaluation selfEvaluation = selfEvaluationRepository.findById(request.selfEvaluationId())
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró la autoevaluación."));
        Availability availability = availabilityRepository.findByIdForUpdate(request.availabilityId())
                .orElseThrow(() -> new BusinessException(MISSING_SLOT_MESSAGE));
        User ergonomist = availability.getUser();
        currentUserService.checkOwnerOrAdmin(ergonomist.getId());
        if (!selfEvaluation.getCompany().isActive()) {
            throw new BusinessException("La empresa está inactiva. No se pueden agendar citas.");
        }
        checkBookable(availability);
        if (appointmentRepository.existsBySelfEvaluationIdAndStatusIn(selfEvaluation.getId(), AppointmentStatus.PENDING)) {
            throw new DuplicateResourceException("Este colaborador ya tiene una cita pendiente.");
        }

        Appointment appointment = new Appointment();
        appointment.setSelfEvaluation(selfEvaluation);
        appointment.setUser(ergonomist);
        appointment.setStatus(AppointmentStatus.SCHEDULED);
        appointment.setNotes(request.notes());
        assignSlot(appointment, availability);

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
        return toResponses(appointmentRepository.findAgenda(userId, from, to));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AppointmentResponseDTO> findAllAgendas(LocalDateTime from, LocalDateTime to) {
        currentUserService.checkAdmin();
        return toResponses(appointmentRepository.findAllAgendas(from, to));
    }

    @Override
    @Transactional
    public AppointmentResponseDTO cancel(Long id) {
        Appointment appointment = getDetailed(id);
        currentUserService.checkOwnerOrAdmin(appointment.getUser().getId());
        if (!appointment.getStatus().isPending()) {
            throw new BusinessException("Solo se pueden cancelar citas programadas o confirmadas.");
        }
        appointment.setStatus(AppointmentStatus.CANCELLED);
        if (appointment.getAvailability() != null) {
            appointment.getAvailability().setTaken(false);
        }
        historyRepository.save(HistoryEntries.of(HistoryType.APPOINTMENT_CANCELLED, appointment.getSelfEvaluation(),
                null, "Cita cancelada."));
        return toResponse(appointmentRepository.save(appointment), isEvaluated(id));
    }

    @Override
    @Transactional
    public AppointmentResponseDTO reschedule(Long id, AppointmentRescheduleRequestDTO request) {
        Appointment appointment = getDetailed(id);
        currentUserService.checkOwnerOrAdmin(appointment.getUser().getId());
        if (!appointment.getStatus().isPending()) {
            throw new BusinessException("Solo se pueden reprogramar citas programadas o confirmadas.");
        }
        if (!appointment.getSelfEvaluation().getCompany().isActive()) {
            throw new BusinessException("La empresa está inactiva. No se pueden reprogramar citas.");
        }
        Availability current = appointment.getAvailability();
        if (current != null && current.getId().equals(request.availabilityId())) {
            return toResponse(appointment, isEvaluated(id));
        }
        Availability next = availabilityRepository.findByIdForUpdate(request.availabilityId())
                .orElseThrow(() -> new BusinessException(MISSING_SLOT_MESSAGE));
        if (!next.getUser().getId().equals(appointment.getUser().getId())) {
            throw new BusinessException("El nuevo espacio debe pertenecer al mismo ergonomista.");
        }
        checkBookable(next);
        if (current != null) {
            current.setTaken(false);
        }
        assignSlot(appointment, next);

        Appointment saved = appointmentRepository.save(appointment);
        historyRepository.save(HistoryEntries.of(HistoryType.APPOINTMENT_RESCHEDULED, appointment.getSelfEvaluation(), null,
                "Cita reprogramada para el " + HISTORY_DATE_FORMAT.format(saved.getStartDateTime())
                        + " con " + appointment.getUser().getFullName() + "."));
        return toResponse(saved, isEvaluated(id));
    }

    /**
     * Fails when a slot cannot take a new appointment: it is booked or already passed.
     *
     * @param availability slot chosen by the user, locked
     */
    private static void checkBookable(Availability availability) {
        if (availability.isTaken()) {
            throw new BusinessException("El espacio seleccionado ya fue reservado. Elija otro horario.");
        }
        if (!availability.getStartDateTime().isAfter(LocalDateTime.now())) {
            throw new BusinessException("El espacio seleccionado ya pasó. Elija otro horario.");
        }
    }

    /**
     * Places an appointment on a slot and marks the slot as booked.
     *
     * @param appointment appointment to place
     * @param availability free slot that receives it
     */
    private static void assignSlot(Appointment appointment, Availability availability) {
        availability.setTaken(true);
        appointment.setAvailability(availability);
        appointment.setStartDateTime(availability.getStartDateTime());
        appointment.setEndDateTime(availability.getEndDateTime());
    }

    /**
     * Reads an appointment with what its response needs, or fails with HTTP 404.
     *
     * @param id identifier of the appointment
     * @return the appointment
     */
    private Appointment getDetailed(Long id) {
        return appointmentRepository.findDetailedById(id)
                .orElseThrow(() -> new ResourceNotFoundException(APPOINTMENT_NOT_FOUND_MESSAGE));
    }

    /**
     * Tells whether an appointment already has its personalized evaluation.
     *
     * @param id identifier of the appointment
     * @return true when it was evaluated
     */
    private boolean isEvaluated(Long id) {
        return personalizedEvaluationRepository.existsByAppointmentId(id);
    }

    /**
     * Maps appointments to responses, telling which ones already have a
     * personalized evaluation with a single query.
     *
     * @param appointments appointments with their associations loaded
     * @return appointment responses in the same order
     */
    private List<AppointmentResponseDTO> toResponses(List<Appointment> appointments) {
        if (appointments.isEmpty()) {
            return List.of();
        }
        Set<Long> evaluated = new HashSet<>(personalizedEvaluationRepository
                .findEvaluatedAppointmentIds(appointments.stream().map(Appointment::getId).toList()));
        return appointments.stream()
                .map(appointment -> toResponse(appointment, evaluated.contains(appointment.getId())))
                .toList();
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
