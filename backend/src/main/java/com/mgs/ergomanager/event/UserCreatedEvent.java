package com.mgs.ergomanager.event;

/**
 * Event published after a new application user has been prepared for creation.
 *
 * @param email             email assigned to the new user
 * @param temporaryPassword temporary password that must be delivered by email
 */
public record UserCreatedEvent(
        String email,
        String temporaryPassword) {
}