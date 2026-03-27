package com.fakeradar.repository;

import com.fakeradar.model.Analysis;
import com.fakeradar.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AnalysisRepository extends JpaRepository<Analysis, UUID> {
    List<Analysis> findByUserOrderByCreatedAtDesc(User user);
}
