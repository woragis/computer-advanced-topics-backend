package com.fakeradar.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.*;

@Entity
@Table(name = "analyses")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Analysis {
    public enum Verdict {
        RELIABLE, SUSPICIOUS, FAKE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private String inputUrl;

    @Column(columnDefinition = "TEXT")
    private String inputText;

    private Float credibilityScore;

    @Enumerated(EnumType.STRING)
    private Verdict verdict;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @OneToMany(mappedBy = "analysis", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Claim> claims = new ArrayList<>();

    @CreationTimestamp
    private LocalDateTime createdAt;
}
