package com.mgs.ergomanager.controller;

import com.mgs.ergomanager.dto.user.UserRequestDTO;
import com.mgs.ergomanager.dto.user.UserResponseDTO;
import com.mgs.ergomanager.dto.user.UserUpdateRequestDTO;
import com.mgs.ergomanager.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints used by the administrator to manage administrators and ergonomists.
 */
@RestController
@RequestMapping("/api/users")
@Tag(name = "Users", description = "Management of administrators and ergonomists")
public class UserController {

    private final UserService userService;

    /**
     * Builds the controller with its service.
     *
     * @param userService service that manages the users
     */
    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * Returns every registered user.
     *
     * @return list of users
     */
    @GetMapping
    public ResponseEntity<List<UserResponseDTO>> findAll() {
        return ResponseEntity.ok(userService.findAll());
    }

    /**
     * Returns a single user.
     *
     * @param id identifier of the user
     * @return the user
     */
    @GetMapping("/{id}")
    public ResponseEntity<UserResponseDTO> findById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.findById(id));
    }

    /**
     * Registers a new user.
     *
     * @param request data of the user
     * @return the created user
     */
    @PostMapping
    public ResponseEntity<UserResponseDTO> create(@Valid @RequestBody UserRequestDTO request) {
        UserResponseDTO created = userService.create(request);
        return ResponseEntity.created(URI.create("/api/users/" + created.id())).body(created);
    }

    /**
     * Updates the data of an existing user.
     *
     * @param id      identifier of the user
     * @param request new data of the user
     * @return the updated user
     */
    @PutMapping("/{id}")
    public ResponseEntity<UserResponseDTO> update(@PathVariable Long id, @Valid @RequestBody UserUpdateRequestDTO request) {
        return ResponseEntity.ok(userService.update(id, request));
    }

    /**
     * Deactivates a user so it can no longer sign in.
     *
     * @param id identifier of the user
     * @return empty response with HTTP status 204
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        userService.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
