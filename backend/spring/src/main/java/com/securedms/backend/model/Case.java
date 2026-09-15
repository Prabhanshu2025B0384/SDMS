package com.securedms.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.List;

@Entity
@Table(name = "cases", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"station_code", "filing_year", "case_number"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Case {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(columnDefinition = "UUID", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "station_code")
    private String stationCode;

    @Column(name = "filing_year")
    private Integer filingYear;

    @Column(name = "case_number", nullable = false)
    private String caseNumber;

    @Column(nullable = false)
    private String status = "CREATED";

    @Column(nullable = false)
    private String jurisdiction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owning_officer_id", nullable = false)
    private User owningOfficer;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Version
    @Column(name = "version")
    private Long version;

    @OneToMany(mappedBy = "caseObj", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Document> documents;
}
