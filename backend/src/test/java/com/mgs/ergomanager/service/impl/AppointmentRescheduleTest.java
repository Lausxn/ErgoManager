package com.mgs.ergomanager.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mgs.ergomanager.dto.appointment.AppointmentRescheduleRequestDTO;
import com.mgs.ergomanager.exception.BusinessException;
import com.mgs.ergomanager.hu.UserStories;
import com.mgs.ergomanager.model.Appointment;
import com.mgs.ergomanager.model.Availability;
import com.mgs.ergomanager.model.Company;
import com.mgs.ergomanager.model.History;
import com.mgs.ergomanager.model.SelfEvaluation;
import com.mgs.ergomanager.model.User;
import com.mgs.ergomanager.model.enums.AppointmentStatus;
import com.mgs.ergomanager.model.enums.Role;
import com.mgs.ergomanager.repository.AppointmentRepository;
import com.mgs.ergomanager.repository.AvailabilityRepository;
import com.mgs.ergomanager.repository.HistoryRepository;
import com.mgs.ergomanager.repository.PersonalizedEvaluationRepository;
import com.mgs.ergomanager.repository.SelfEvaluationRepository;
import com.mgs.ergomanager.security.CurrentUserService;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for appointment cancellation and rescheduling rules.
 */
@ExtendWith(MockitoExtension.class)
class AppointmentRescheduleTest {

    @Mock
    private AvailabilityRepository availabilityRepository;

    @Mock
    private AppointmentRepository appointmentRepository;

    @Mock
    private SelfEvaluationRepository selfEvaluationRepository;

    @Mock
    private PersonalizedEvaluationRepository personalizedEvaluationRepository;

    @Mock
    private HistoryRepository historyRepository;

    @Mock
    private CurrentUserService currentUserService;

    private AppointmentServiceImpl appointmentService;

    /**
     * Creates the service under test with mocked collaborators.
     */
    @BeforeEach
    void setUp() {
        appointmentService = new AppointmentServiceImpl(
                availabilityRepository,
                appointmentRepository,
                selfEvaluationRepository,
                personalizedEvaluationRepository,
                historyRepository,
                currentUserService);
    }

    /**
     * Verifies that cancelling a scheduled appointment changes its state and
     * frees the associated availability.
     */
    @Test
    void cancelShouldCancelPendingAppointmentAndFreeAvailability() {
        Appointment appointment =
                buildAppointment(
                        1L,
                        AppointmentStatus.SCHEDULED);

        Availability availability =
                appointment.getAvailability();

        when(appointmentRepository.findDetailedById(1L))
                .thenReturn(Optional.of(appointment));

        when(appointmentRepository.save(appointment))
                .thenReturn(appointment);

        when(personalizedEvaluationRepository
                .existsByAppointmentId(1L))
                .thenReturn(false);

        var response =
                appointmentService.cancel(1L);

        assertEquals(
                AppointmentStatus.CANCELLED,
                appointment.getStatus());

        assertFalse(
                availability.isTaken());

        assertEquals(
                AppointmentStatus.CANCELLED,
                response.status());

        verify(currentUserService)
                .checkOwnerOrAdmin(
                        appointment.getUser().getId());

        verify(appointmentRepository)
                .save(appointment);

        verify(historyRepository)
                .save(any(History.class));
    }

    /**
     * Verifies that cancelling a confirmed appointment also releases its
     * availability.
     */
    @Test
    void cancelShouldAllowConfirmedAppointment() {
        Appointment appointment =
                buildAppointment(
                        2L,
                        AppointmentStatus.CONFIRMED);

        when(appointmentRepository.findDetailedById(2L))
                .thenReturn(Optional.of(appointment));

        when(appointmentRepository.save(appointment))
                .thenReturn(appointment);

        var response =
                appointmentService.cancel(2L);

        assertEquals(
                AppointmentStatus.CANCELLED,
                response.status());

        assertFalse(
                appointment.getAvailability()
                        .isTaken());
    }

    /**
     * Verifies that an appointment that is no longer pending cannot be
     * cancelled.
     */
    @Test
    void cancelShouldRejectCompletedAppointment() {
        Appointment appointment =
                buildAppointment(
                        3L,
                        AppointmentStatus.COMPLETED);

        when(appointmentRepository.findDetailedById(3L))
                .thenReturn(Optional.of(appointment));

        BusinessException exception =
                assertThrows(
                        BusinessException.class,
                        () ->
                                appointmentService.cancel(
                                        3L));

        assertEquals(
                "Solo se pueden cancelar citas programadas o confirmadas.",
                exception.getMessage());

        assertTrue(
                appointment.getAvailability()
                        .isTaken());

        verify(appointmentRepository, never())
                .save(any(Appointment.class));

        verify(historyRepository, never())
                .save(any(History.class));
    }

    /**
     * Verifies that a pending appointment can be moved to another available
     * slot belonging to the same ergonomist.
     */
    @Test
    void rescheduleShouldMoveAppointmentToFreeAvailability() {
        Appointment appointment =
                buildAppointment(
                        4L,
                        AppointmentStatus.SCHEDULED);

        Availability oldAvailability =
                appointment.getAvailability();

        Availability newAvailability =
                buildAvailability(
                        20L,
                        appointment.getUser(),
                        LocalDateTime.now()
                                .plusDays(3),
                        LocalDateTime.now()
                                .plusDays(3)
                                .plusHours(1),
                        false);

        AppointmentRescheduleRequestDTO request =
                new AppointmentRescheduleRequestDTO(
                        newAvailability.getId());

        when(appointmentRepository.findDetailedById(4L))
                .thenReturn(Optional.of(appointment));

        when(availabilityRepository.findByIdForUpdate(20L))
                .thenReturn(Optional.of(newAvailability));

        when(appointmentRepository.save(appointment))
                .thenReturn(appointment);

        when(personalizedEvaluationRepository
                .existsByAppointmentId(4L))
                .thenReturn(false);

        var response =
                appointmentService.reschedule(
                        4L,
                        request);

        assertFalse(
                oldAvailability.isTaken());

        assertTrue(
                newAvailability.isTaken());

        assertEquals(
                newAvailability,
                appointment.getAvailability());

        assertEquals(
                newAvailability.getStartDateTime(),
                appointment.getStartDateTime());

        assertEquals(
                newAvailability.getEndDateTime(),
                appointment.getEndDateTime());

        assertEquals(
                newAvailability.getStartDateTime(),
                response.startDateTime());

        assertEquals(
                newAvailability.getEndDateTime(),
                response.endDateTime());

        assertEquals(
                AppointmentStatus.SCHEDULED,
                response.status());

        verify(appointmentRepository)
                .save(appointment);

        verify(historyRepository)
                .save(any(History.class));
    }

    /**
     * Verifies that a confirmed appointment can also be rescheduled.
     */
    @Test
    void rescheduleShouldAllowConfirmedAppointment() {
        Appointment appointment =
                buildAppointment(
                        5L,
                        AppointmentStatus.CONFIRMED);

        Availability newAvailability =
                buildAvailability(
                        21L,
                        appointment.getUser(),
                        LocalDateTime.now()
                                .plusDays(4),
                        LocalDateTime.now()
                                .plusDays(4)
                                .plusHours(1),
                        false);

        when(appointmentRepository.findDetailedById(5L))
                .thenReturn(Optional.of(appointment));

        when(availabilityRepository.findByIdForUpdate(21L))
                .thenReturn(Optional.of(newAvailability));

        when(appointmentRepository.save(appointment))
                .thenReturn(appointment);

        var response =
                appointmentService.reschedule(
                        5L,
                        new AppointmentRescheduleRequestDTO(
                                21L));

        assertEquals(
                AppointmentStatus.CONFIRMED,
                response.status());

        assertTrue(
                newAvailability.isTaken());

        assertEquals(
                newAvailability,
                appointment.getAvailability());
    }

    /**
     * Verifies that an already occupied slot cannot be used to reschedule an
     * appointment.
     */
    @Test
    void rescheduleShouldRejectTakenAvailability() {
        Appointment appointment =
                buildAppointment(
                        6L,
                        AppointmentStatus.SCHEDULED);

        Availability oldAvailability =
                appointment.getAvailability();

        Availability takenAvailability =
                buildAvailability(
                        22L,
                        appointment.getUser(),
                        LocalDateTime.now()
                                .plusDays(5),
                        LocalDateTime.now()
                                .plusDays(5)
                                .plusHours(1),
                        true);

        when(appointmentRepository.findDetailedById(6L))
                .thenReturn(Optional.of(appointment));

        when(availabilityRepository.findByIdForUpdate(22L))
                .thenReturn(
                        Optional.of(
                                takenAvailability));

        BusinessException exception =
                assertThrows(
                        BusinessException.class,
                        () ->
                                appointmentService
                                        .reschedule(
                                                6L,
                                                new AppointmentRescheduleRequestDTO(
                                                        22L)));

        assertEquals(
                "El espacio seleccionado ya fue reservado. Elija otro horario.",
                exception.getMessage());

        assertTrue(
                oldAvailability.isTaken());

        assertTrue(
                takenAvailability.isTaken());

        assertEquals(
                oldAvailability,
                appointment.getAvailability());

        verify(appointmentRepository, never())
                .save(any(Appointment.class));

        verify(historyRepository, never())
                .save(any(History.class));
    }

    /**
     * Verifies that an appointment cannot be moved to a slot belonging to
     * another ergonomist.
     */
    @Test
    void rescheduleShouldRejectAvailabilityFromAnotherErgonomist() {
        Appointment appointment =
                buildAppointment(
                        7L,
                        AppointmentStatus.SCHEDULED);

        User anotherErgonomist =
                buildErgonomist(
                        99L,
                        "Ana",
                        "Ramirez");

        Availability foreignAvailability =
                buildAvailability(
                        23L,
                        anotherErgonomist,
                        LocalDateTime.now()
                                .plusDays(6),
                        LocalDateTime.now()
                                .plusDays(6)
                                .plusHours(1),
                        false);

        when(appointmentRepository.findDetailedById(7L))
                .thenReturn(Optional.of(appointment));

        when(availabilityRepository.findByIdForUpdate(23L))
                .thenReturn(
                        Optional.of(
                                foreignAvailability));

        BusinessException exception =
                assertThrows(
                        BusinessException.class,
                        () ->
                                appointmentService
                                        .reschedule(
                                                7L,
                                                new AppointmentRescheduleRequestDTO(
                                                        23L)));

        assertEquals(
                "El nuevo espacio debe pertenecer al mismo ergonomista.",
                exception.getMessage());

        assertTrue(
                appointment.getAvailability()
                        .isTaken());

        assertFalse(
                foreignAvailability.isTaken());

        verify(appointmentRepository, never())
                .save(any(Appointment.class));
    }

    /**
     * Verifies that an appointment that has already been completed cannot be
     * rescheduled.
     */
    @Test
    void rescheduleShouldRejectCompletedAppointment() {
        Appointment appointment =
                buildAppointment(
                        8L,
                        AppointmentStatus.COMPLETED);

        when(appointmentRepository.findDetailedById(8L))
                .thenReturn(Optional.of(appointment));

        BusinessException exception =
                assertThrows(
                        BusinessException.class,
                        () ->
                                appointmentService
                                        .reschedule(
                                                8L,
                                                new AppointmentRescheduleRequestDTO(
                                                        24L)));

        assertEquals(
                "Solo se pueden reprogramar citas programadas o confirmadas.",
                exception.getMessage());

        verify(availabilityRepository, never())
                .findByIdForUpdate(any());

        verify(appointmentRepository, never())
                .save(any(Appointment.class));

        verify(historyRepository, never())
                .save(any(History.class));
    }

    /**
     * Verifies that a slot whose start date has already passed cannot be used
     * for rescheduling.
     */
    @Test
    void rescheduleShouldRejectPastAvailability() {
        Appointment appointment =
                buildAppointment(
                        9L,
                        AppointmentStatus.SCHEDULED);

        Availability pastAvailability =
                buildAvailability(
                        25L,
                        appointment.getUser(),
                        LocalDateTime.now()
                                .minusHours(2),
                        LocalDateTime.now()
                                .minusHours(1),
                        false);

        when(appointmentRepository.findDetailedById(9L))
                .thenReturn(Optional.of(appointment));

        when(availabilityRepository.findByIdForUpdate(25L))
                .thenReturn(
                        Optional.of(
                                pastAvailability));

        BusinessException exception =
                assertThrows(
                        BusinessException.class,
                        () ->
                                appointmentService
                                        .reschedule(
                                                9L,
                                                new AppointmentRescheduleRequestDTO(
                                                        25L)));

        assertEquals(
                "El espacio seleccionado ya pasó. Elija otro horario.",
                exception.getMessage());

        assertTrue(
                appointment.getAvailability()
                        .isTaken());

        assertFalse(
                pastAvailability.isTaken());

        verify(appointmentRepository, never())
                .save(any(Appointment.class));
    }

    /**
     * Verifies that selecting the current slot keeps the appointment unchanged
     * instead of reporting that the slot is already occupied.
     */
    @Test
    void rescheduleShouldKeepAppointmentWhenSameAvailabilityIsSelected() {
        Appointment appointment =
                buildAppointment(
                        10L,
                        AppointmentStatus.SCHEDULED);

        Availability currentAvailability =
                appointment.getAvailability();

        when(appointmentRepository.findDetailedById(10L))
                .thenReturn(Optional.of(appointment));

        when(personalizedEvaluationRepository
                .existsByAppointmentId(10L))
                .thenReturn(false);

        var response =
                appointmentService.reschedule(
                        10L,
                        new AppointmentRescheduleRequestDTO(
                                currentAvailability.getId()));

        assertSame(
                currentAvailability,
                appointment.getAvailability());

        assertTrue(
                currentAvailability.isTaken());

        assertEquals(
                currentAvailability.getStartDateTime(),
                response.startDateTime());

        verify(availabilityRepository, never())
                .findByIdForUpdate(any());

        verify(appointmentRepository, never())
                .save(any(Appointment.class));

        verify(historyRepository, never())
                .save(any(History.class));
    }

    /**
     * Verifies that an appointment belonging to an inactive company cannot be
     * rescheduled.
     */
    @Test
    @Tag(UserStories.HU_021)
    void rescheduleShouldRejectInactiveCompany() {
        Appointment appointment =
                buildAppointment(
                        11L,
                        AppointmentStatus.SCHEDULED);

        appointment.getSelfEvaluation()
                .getCompany()
                .setActive(false);

        when(appointmentRepository.findDetailedById(11L))
                .thenReturn(Optional.of(appointment));

        BusinessException exception =
                assertThrows(
                        BusinessException.class,
                        () ->
                                appointmentService
                                        .reschedule(
                                                11L,
                                                new AppointmentRescheduleRequestDTO(
                                                        26L)));

        assertEquals(
                "La empresa está inactiva. No se pueden reprogramar citas.",
                exception.getMessage());

        verify(availabilityRepository, never())
                .findByIdForUpdate(any());

        verify(appointmentRepository, never())
                .save(any(Appointment.class));

        verify(historyRepository, never())
                .save(any(History.class));
    }

    /**
     * Creates an appointment with all associations required by the response
     * mapper.
     *
     * @param id     identifier of the appointment
     * @param status current appointment state
     * @return appointment configured for the test
     */
    private static Appointment buildAppointment(
            Long id,
            AppointmentStatus status) {

        User ergonomist =
                buildErgonomist(
                        10L,
                        "Carlos",
                        "Mora");

        Company company =
                new Company();

        company.setId(30L);
        company.setBusinessName(
                "Empresa de prueba");
        company.setContactEmail(
                "contacto@empresa.test");
        company.setActive(true);

        SelfEvaluation selfEvaluation =
                new SelfEvaluation();

        selfEvaluation.setId(40L);
        selfEvaluation.setCompany(company);
        selfEvaluation.setEmployeeName(
                "Persona de prueba");
        selfEvaluation.setEmployeeEmail(
                "persona@empresa.test");

        Availability availability =
                buildAvailability(
                        50L,
                        ergonomist,
                        LocalDateTime.now()
                                .plusDays(1),
                        LocalDateTime.now()
                                .plusDays(1)
                                .plusHours(1),
                        true);

        Appointment appointment =
                new Appointment();

        appointment.setId(id);
        appointment.setSelfEvaluation(
                selfEvaluation);
        appointment.setUser(
                ergonomist);
        appointment.setAvailability(
                availability);
        appointment.setStartDateTime(
                availability.getStartDateTime());
        appointment.setEndDateTime(
                availability.getEndDateTime());
        appointment.setStatus(status);
        appointment.setNotes(
                "Cita de prueba");

        return appointment;
    }

    /**
     * Creates an ergonomist used by the appointment tests.
     *
     * @param id        identifier of the user
     * @param firstName first name
     * @param lastName  first surname
     * @return ergonomist configured for the test
     */
    private static User buildErgonomist(
            Long id,
            String firstName,
            String lastName) {

        User user =
                new User();

        user.setId(id);
        user.setFirstName(firstName);
        user.setFirstLastName(lastName);
        user.setEmail(
                firstName.toLowerCase()
                        + "@ergomanager.test");
        user.setPassword(
                "test-password");
        user.setRole(
                Role.ERGONOMIST);
        user.setActive(true);

        return user;
    }

    /**
     * Creates an availability used by the appointment tests.
     *
     * @param id        identifier of the slot
     * @param user      owner ergonomist
     * @param start     start of the slot
     * @param end       end of the slot
     * @param taken     whether the slot is occupied
     * @return availability configured for the test
     */
    private static Availability buildAvailability(
            Long id,
            User user,
            LocalDateTime start,
            LocalDateTime end,
            boolean taken) {

        Availability availability =
                new Availability();

        availability.setId(id);
        availability.setUser(user);
        availability.setStartDateTime(start);
        availability.setEndDateTime(end);
        availability.setTaken(taken);

        return availability;
    }
}