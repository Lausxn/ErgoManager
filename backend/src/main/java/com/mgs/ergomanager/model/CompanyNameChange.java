package com.mgs.ergomanager.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;

/**
 * Business name a client company used before it was renamed. It keeps the
 * reports of the client reachable by that name and reserves the name, so no
 * other company can take it: the comparison key is unique.
 */
@Entity
@Table(name = "company_name_changes", uniqueConstraints =
        @UniqueConstraint(name = CompanyNameChange.KEY_CONSTRAINT, columnNames = "business_name_key"))
public class CompanyNameChange {

    /** Name of the unique constraint over the comparison key of the previous name. */
    public static final String KEY_CONSTRAINT = "uk_company_name_changes_key";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    /** Previous name, as the company used it. */
    @Column(name = "business_name", nullable = false, length = 150)
    private String businessName;

    /** Comparison key of the previous name, built by {@link CompanyKeys#businessNameKey}. */
    @Column(name = "business_name_key", nullable = false, length = 64)
    private String businessNameKey;

    /** Last moment the company stopped using this name. */
    @Column(name = "changed_at", nullable = false)
    private LocalDateTime changedAt;

    /** User who renamed the company, kept for auditing. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by_user_id")
    private User changedBy;

    public Long getId() {
        return id;
    }

    public Company getCompany() {
        return company;
    }

    public void setCompany(Company company) {
        this.company = company;
    }

    public String getBusinessName() {
        return businessName;
    }

    /**
     * Sets the previous name together with its comparison key.
     *
     * @param businessName previous name of the company
     */
    public void setBusinessName(String businessName) {
        this.businessName = businessName;
        this.businessNameKey = CompanyKeys.businessNameKey(businessName);
    }

    public String getBusinessNameKey() {
        return businessNameKey;
    }

    public LocalDateTime getChangedAt() {
        return changedAt;
    }

    public void setChangedAt(LocalDateTime changedAt) {
        this.changedAt = changedAt;
    }

    public User getChangedBy() {
        return changedBy;
    }

    public void setChangedBy(User changedBy) {
        this.changedBy = changedBy;
    }
}
