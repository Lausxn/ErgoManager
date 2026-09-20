package com.mgs.ergomanager.controller;

import com.mgs.ergomanager.dto.appointment.AppointmentRequest;
import com.mgs.ergomanager.dto.appointment.AppointmentResponse;
import com.mgs.ergomanager.dto.appointment.AvailabilityRequest;
import com.mgs.ergomanager.dto.appointment.AvailabilityResponse;
import com.mgs.ergomanager.service.AppointmentService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints of the availability published by the ergonomists and of the
 * appointments booked on it.
 */
@RestController
@RequestMapping("/api/appointments")
@Tag(name = "Appointments", description = "Availability of the ergonomists and booked appointments")
public class AppointmentController {

    private final AppointmentService appointmentService;

    /**
     * Builds the controller with its service.
     *
     * @param appointmentService service that manages the agenda
     */
    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    /**
     * Publishes a new time slot for an ergonomist.
     *
     * @param request data of the slot
     * @return the created slot
     */
    @PostMapping("/availabilities")
    public ResponseEntity<AvailabilityResponse> createAvailability(
            @Valid @RequestBody AvailabilityRequest request) {
        AvailabilityResponse created = appointmentService.createAvailability(request);
        return ResponseEntity.created(URI.create("/api/appointments/availabilities/" + created.id())).body(created);
    }

    /**
     * Returns the free slots of an ergonomist inside a date range.
     *
     * @param userId identifier of the ergonomist
     * @param from   beginning of the range
     * @param to     end of the range
     * @return list of free slots
     */
    @GetMapping("/availabilities")
    public ResponseEntity<List<AvailabilityResponse>> findFreeAvailabilities(
            @RequestParam Long userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        return ResponseEntity.ok(appointmentService.findFreeAvailabilities(userId, from, to));
    }

    /**
     * Books an appointment on a free slot.
     *
     * @param request slot chosen by the employee
     * @return the booked appointment
     */
    @PostMapping
    public ResponseEntity<AppointmentResponse> book(@Valid @RequestBody AppointmentRequest request) {
        AppointmentResponse created = appointmentService.book(request);
        return ResponseEntity.created(URI.create("/api/appointments/" + created.id())).body(created);
    }

    /**
     * Returns the agenda of an ergonomist inside a date range.
     *
     * @param userId identifier of the ergonomist
     * @param from   beginning of the range
     * @param to     end of the range
     * @return list of appointments
     */
    @GetMapping
    public ResponseEntity<List<AppointmentResponse>> findAgenda(
            @RequestParam Long userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        return ResponseEntity.ok(appointmentService.findAgenda(userId, from, to));
    }

    /**
     * Cancels an appointment and frees its slot.
     *
     * @param id identifier of the appointment
     * @return the cancelled appointment
     */
    @PatchMapping("/{id}/cancel")
    public ResponseEntity<AppointmentResponse> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(appointmentService.cancel(id));
    }
}
