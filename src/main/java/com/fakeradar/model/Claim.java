package com.fakeradar.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "claims")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Claim {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_id", nullable = false)
    private Analysis analysis;

    @Column(columnDefinition = "TEXT")
    private String text;

    private Boolean isVerified;
    private Float confidence;
    private String sourceUrl;
}
