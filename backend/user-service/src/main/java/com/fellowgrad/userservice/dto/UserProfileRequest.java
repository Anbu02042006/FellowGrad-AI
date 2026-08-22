package com.fellowgrad.userservice.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UserProfileRequest {
    @NotBlank(message = "Name is required")
    private String name;
    
    private String educationLevel;
    private String college;
    private String course;
    private String interests;
    private String careerGoals;
    private String skills;
}
