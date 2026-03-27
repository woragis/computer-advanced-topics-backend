package com.fakeradar.controller;

import com.fakeradar.model.Analysis;
import com.fakeradar.repository.AnalysisRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/analyses")
@RequiredArgsConstructor
public class AnalysisController {
    private final AnalysisRepository analysisRepository;

    @GetMapping
    public List<Analysis> getAllAnalyses() {
        return analysisRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Analysis> getAnalysisById(@PathVariable UUID id) {
        Optional<Analysis> analysis = analysisRepository.findById(id);
        return analysis.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public Analysis createAnalysis(@RequestBody Analysis analysis) {
        return analysisRepository.save(analysis);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Analysis> updateAnalysis(@PathVariable UUID id, @RequestBody Analysis analysisDetails) {
        return analysisRepository.findById(id)
                .map(analysis -> {
                    analysis.setInputUrl(analysisDetails.getInputUrl());
                    analysis.setInputText(analysisDetails.getInputText());
                    analysis.setCredibilityScore(analysisDetails.getCredibilityScore());
                    analysis.setVerdict(analysisDetails.getVerdict());
                    analysis.setExplanation(analysisDetails.getExplanation());
                    return ResponseEntity.ok(analysisRepository.save(analysis));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAnalysis(@PathVariable UUID id) {
        if (analysisRepository.existsById(id)) {
            analysisRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
