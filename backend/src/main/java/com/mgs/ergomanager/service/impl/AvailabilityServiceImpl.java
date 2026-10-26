package com.mgs.ergomanager.service.impl;

import com.mgs.ergomanager.dto.appointment.AvailabilityRequestDTO;
import com.mgs.ergomanager.dto.appointment.AvailabilityResponseDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.exception.DuplicateResourceException;
import com.mgs.ergomanager.exception.ResourceNotFoundException;
import com.mgs.ergomanager.model.Availability;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.AppointmentRepository;
import com.mgs.ergomanager.repository.AvailabilityRepository;
import com.mgs.ergomanager.repository.UserRepository;
import com.mgs.ergomanager.security.CurrentUserService;
import com.mgs.ergomanager.service.AvailabilityService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default implementation of {@link AvailabilityService}. An administrator works
 * with every agenda; an ergonomist only with their own.
 */
@Service
public class AvailabilityServiceImpl implements AvailabilityService {

    private static final String OVERLAP_MESSAGE = "El horario seleccionado se cruza con una disponibilidad existente. Seleccione otro rango de fecha y hora.";
    private static final String AVAILABILITY_NOT_FOUND_MESSAGE = "No se encontró la disponibilidad.";
    private static final String NOT_AN_ERGONOMIST_MESSAGE = "El usuario seleccionado no es un ergónomo activo.";
    private static final String END_BEFORE_START_MESSAGE = "La hora de fin debe ser posterior a la de inicio.";
    private final AvailabilityRepository availabilityRepository;
    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;

    /**
     * Builds the service with its collaborators.
     *
     * @param availabilityRepository repository of published time slots
     * @param appointmentRepository  repository of booked appointments
     * @param userRepository         repository of application users, locked to serialize each agenda
     * @param currentUserService     access to the signed in user
     */
    public AvailabilityServiceImpl(AvailabilityRepository availabilityRepository, AppointmentRepository appointmentRepository,
                                   UserRepository userRepository, CurrentUserService currentUserService) {
        this.availabilityRepository = availabilityRepository;
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
        this.currentUserService = currentUserService;
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public AvailabilityResponseDTO createAvailability(AvailabilityRequestDTO request) {
        currentUserService.checkOwnerOrAdmin(request.userId());
        // Serialize range checks and writes for this agenda, even when it has no slots yet.
        User ergonomist = userRepository.findByIdForUpdate(request.userId())
                .filter(this::canHaveAgenda)
                .orElseThrow(() -> new BusinessException(NOT_AN_ERGONOMIST_MESSAGE));
        if (!request.endDateTime().isAfter(request.startDateTime())) {
            throw new BusinessException(END_BEFORE_START_MESSAGE);
        }
        if (availabilityRepository.existsByUserIdAndStartDateTimeBeforeAndEndDateTimeAfter(
                ergonomist.getId(), request.endDateTime(), request.startDateTime())) {
            throw new DuplicateResourceException(OVERLAP_MESSAGE);
        }
        Availability availability = new Availability();
        availability.setUser(ergonomist);
        availability.setStartDateTime(request.startDateTime());
        availability.setEndDateTime(request.endDateTime());
        availability.setTaken(false);
        return toResponse(availabilityRepository.save(availability));
    }

    @Override
    @Transactional(readOnly = true)
    public AvailabilityResponseDTO findAvailabilityById(Long id) {
        Availability availability = availabilityRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(AVAILABILITY_NOT_FOUND_MESSAGE));
        currentUserService.checkOwnerOrAdmin(availability.getUser().getId());
        return toResponse(availability);
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public AvailabilityResponseDTO updateAvailability(Long id, AvailabilityRequestDTO request) {
        // Uses the same lock as booking/deletion so a reserved slot cannot be edited.
        Availability availability = getForUpdate(id);
        User ergonomist = availability.getUser();
        currentUserService.checkOwnerOrAdmin(ergonomist.getId());
        if (!ergonomist.getId().equals(request.userId())) {
            throw new BusinessException("No se puede cambiar el propietario de la disponibilidad.");
        }
        if (availability.isTaken()) {
            throw new BusinessException("No se puede editar un espacio que ya tiene una cita.");
        }
        // Share the creation lock; READ_COMMITTED sees ranges saved while this request waited.
        userRepository.findByIdForUpdate(ergonomist.getId())
                .orElseThrow(() -> new BusinessException(NOT_AN_ERGONOMIST_MESSAGE));
        if (!canHaveAgenda(ergonomist)) {
            throw new BusinessException(NOT_AN_ERGONOMIST_MESSAGE);
        }
        if (!request.endDateTime().isAfter(request.startDateTime())) {
            throw new BusinessException(END_BEFORE_START_MESSAGE);
        }
        if (availabilityRepository.existsByUserIdAndIdNotAndStartDateTimeBeforeAndEndDateTimeAfter(
                ergonomist.getId(), id, request.endDateTime(), request.startDateTime())) {
            throw new DuplicateResourceException(OVERLAP_MESSAGE);
        }
        availability.setStartDateTime(request.startDateTime());
        availability.setEndDateTime(request.endDateTime());
        return toResponse(availabilityRepository.save(availability));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AvailabilityResponseDTO> findFreeAvailabilities(Long userId, LocalDateTime from, LocalDateTime to) {
        currentUserService.checkOwnerOrAdmin(userId);
        return availabilityRepository
                .findByUserIdAndTakenFalseAndStartDateTimeBetweenOrderByStartDateTimeAsc(userId, from, to)
                .stream()
                .map(AvailabilityServiceImpl::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public void deleteAvailability(Long id) {
        Availability availability = getForUpdate(id);
        currentUserService.checkOwnerOrAdmin(availability.getUser().getId());
        if (availability.isTaken()) {
            throw new BusinessException("No se puede eliminar un espacio que ya tiene una cita.");
        }
        // Cancelled appointments may still point to the slot.
        appointmentRepository.detachAvailability(id);
        availabilityRepository.deleteById(id);
    }

    /**
     * Reads a slot locking it, with its ergonomist loaded, or fails with HTTP 404.
     *
     * @param id identifier of the slot
     * @return the locked slot
     */
    private Availability getForUpdate(Long id) {
        return availabilityRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException(AVAILABILITY_NOT_FOUND_MESSAGE));
    }

    /**
     * Tells whether a user can publish slots and receive appointments: an active
     * ergonomist, or the signed in administrator for their own agenda, since an
     * administrator also attends appointments.
     *
     * @param user owner of the agenda
     * @return true when the user can have an agenda
     */
    private boolean canHaveAgenda(User user) {
        if (!user.isActive()) {
            return false;
        }
        return user.getRole() == Role.ERGONOMIST
                || (user.getRole() == Role.ADMIN && Objects.equals(user.getId(), currentUserService.getCurrentUser().getId()));
    }

    /**
     * Maps a slot to the representation exposed by the API.
     *
     * @param availability stored slot, with its ergonomist loaded
     * @return slot response
     */
    private static AvailabilityResponseDTO toResponse(Availability availability) {
        return new AvailabilityResponseDTO(
                availability.getId(),
                availability.getUser().getId(),
                availability.getUser().getFullName(),
                availability.getStartDateTime(),
                availability.getEndDateTime(),
                availability.isTaken());
    }
}
