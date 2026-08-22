package com.fellowgrad.userservice.service;

import com.fellowgrad.userservice.dto.UserProfileRequest;
import com.fellowgrad.userservice.dto.UserProfileResponse;
import com.fellowgrad.userservice.entity.UserProfile;
import com.fellowgrad.userservice.exception.ResourceNotFoundException;
import com.fellowgrad.userservice.repository.UserProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserProfileRepository repository;

    public UserProfileResponse getProfile(String userId) {
        UserProfile profile = repository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile not found for user: " + userId));
        return mapToResponse(profile);
    }

    public UserProfileResponse updateProfile(String userId, UserProfileRequest request) {
        UserProfile profile = repository.findByUserId(userId)
                .orElse(UserProfile.builder().userId(userId).build());

        profile.setName(request.getName());
        profile.setEducationLevel(request.getEducationLevel());
        profile.setCollege(request.getCollege());
        profile.setCourse(request.getCourse());
        profile.setInterests(request.getInterests());
        profile.setCareerGoals(request.getCareerGoals());
        profile.setSkills(request.getSkills());

        UserProfile savedProfile = repository.save(profile);
        return mapToResponse(savedProfile);
    }

    private UserProfileResponse mapToResponse(UserProfile profile) {
        return UserProfileResponse.builder()
                .id(profile.getId())
                .userId(profile.getUserId())
                .name(profile.getName())
                .educationLevel(profile.getEducationLevel())
                .college(profile.getCollege())
                .course(profile.getCourse())
                .interests(profile.getInterests())
                .careerGoals(profile.getCareerGoals())
                .skills(profile.getSkills())
                .createdAt(profile.getCreatedAt())
                .updatedAt(profile.getUpdatedAt())
                .build();
    }
}
