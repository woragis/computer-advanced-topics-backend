package com.fakeradar.controller;

import com.fakeradar.model.Claim;
import com.fakeradar.repository.ClaimRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/claims")
@RequiredArgsConstructor
public class ClaimController {
    private final ClaimRepository claimRepository;

    @GetMapping
    public List<Claim> getAllClaims() {
        return claimRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Claim> getClaimById(@PathVariable UUID id) {
        Optional<Claim> claim = claimRepository.findById(id);
        return claim.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public Claim createClaim(@RequestBody Claim claim) {
        return claimRepository.save(claim);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Claim> updateClaim(@PathVariable UUID id, @RequestBody Claim claimDetails) {
        return claimRepository.findById(id)
                .map(claim -> {
                    claim.setText(claimDetails.getText());
                    claim.setIsVerified(claimDetails.getIsVerified());
                    claim.setConfidence(claimDetails.getConfidence());
                    claim.setSourceUrl(claimDetails.getSourceUrl());
                    return ResponseEntity.ok(claimRepository.save(claim));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteClaim(@PathVariable UUID id) {
        if (claimRepository.existsById(id)) {
            claimRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
