package com.mgs.ergomanager.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import org.hibernate.annotations.CreationTimestamp;

/**
 * Client company whose employees fill in the ergonomic self evaluation forms.
 * Two companies can never share a business name or a tax id: the comparison
 * keys of {@link CompanyKeys} are unique in the database.
 */
@Entity
@Table(name = "companies", uniqueConstraints = {
        @UniqueConstraint(name = CompanyKeys.BUSINESS_NAME_CONSTRAINT, columnNames = "business_name_key"),
        @UniqueConstraint(name = CompanyKeys.TAX_ID_CONSTRAINT, columnNames = "tax_id_key")})
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "business_name", nullable = false, length = 150)
    private String businessName;

    @Column(name = "tax_id", nullable = false, unique = true, length = 20)
    private String taxId;

    @Column(name = "contact_email", nullable = false, length = 120)
    private String contactEmail;

    @Column(name = "phone_number", length = 30)
    private String phoneNumber;

    @Column(name = "address", length = 200)
    private String address;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * Comparison key of the business name. Nullable only so existing databases
     * can add the column; it is filled on every insert and update.
     */
    @Column(name = "business_name_key", length = 64)
    private String businessNameKey;

    /** Comparison key of the tax id, filled the same way as the business name key. */
    @Column(name = "tax_id_key", length = 20)
    private String taxIdKey;

    /** Recomputes the comparison keys from the current business name and tax id. */
    @PrePersist
    @PreUpdate
    void refreshKeys() {
        businessNameKey = CompanyKeys.businessNameKey(businessName);
        taxIdKey = CompanyKeys.taxIdKey(taxId);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getBusinessName() {
        return businessName;
    }

    public void setBusinessName(String businessName) {
        this.businessName = businessName;
    }

    public String getTaxId() {
        return taxId;
    }

    public void setTaxId(String taxId) {
        this.taxId = taxId;
    }

    public String getContactEmail() {
        return contactEmail;
    }

    public void setContactEmail(String contactEmail) {
        this.contactEmail = contactEmail;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    /** The key is derived from the business name, so it has no setter. */
    public String getBusinessNameKey() {
        return businessNameKey;
    }

    /** The key is derived from the tax id, so it has no setter. */
    public String getTaxIdKey() {
        return taxIdKey;
    }
}
