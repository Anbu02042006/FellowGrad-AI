package com.fellowgrad.userservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UserProfileResponse {
    private String id;
    private String userId;
    private String name;
    private String educationLevel;
    private String college;
    private String course;
    private String interests;
    private String careerGoals;
    private String skills;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
