package com.fellowgrad.userservice.controller;

import com.fellowgrad.userservice.dto.UserProfileRequest;
import com.fellowgrad.userservice.dto.UserProfileResponse;
import com.fellowgrad.userservice.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService service;

    @GetMapping("/{userId}")
    public ResponseEntity<UserProfileResponse> getUserById(@PathVariable String userId) {
        return ResponseEntity.ok(service.getProfile(userId));
    }

    @PutMapping("/{userId}")
    public ResponseEntity<UserProfileResponse> updateUser(
            @PathVariable String userId,
            @Valid @RequestBody UserProfileRequest request
    ) {
        return ResponseEntity.ok(service.updateProfile(userId, request));
    }

    @GetMapping("/{userId}/profile")
    public ResponseEntity<UserProfileResponse> getProfile(@PathVariable String userId) {
        return ResponseEntity.ok(service.getProfile(userId));
    }

    @PutMapping("/{userId}/profile")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @PathVariable String userId,
            @Valid @RequestBody UserProfileRequest request
    ) {
        return ResponseEntity.ok(service.updateProfile(userId, request));
    }
}
