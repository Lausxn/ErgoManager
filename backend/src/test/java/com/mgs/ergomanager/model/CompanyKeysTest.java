package com.mgs.ergomanager.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.mgs.ergomanager.hu.UserStories;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/** Comparison keys of the business name and the tax id. */
@Tag(UserStories.HU_003)
class CompanyKeysTest {

    @Test
    void cleansTheBusinessNameAsItIsStored() {
        assertThat(CompanyKeys.cleanBusinessName("  Servicios   del\tValle  S.A. ")).isEqualTo("Servicios del Valle S.A.");
        assertThat(CompanyKeys.cleanBusinessName(null)).isNull();
    }

    @Test
    void businessNameKeyIgnoresCaseAndSpaces() {
        String key = CompanyKeys.businessNameKey("Acme S.A.");
        assertThat(CompanyKeys.businessNameKey("  ACME   s.a. ")).isEqualTo(key);
        assertThat(key).hasSize(64).matches("[0-9a-f]+");
    }

    @Test
    void businessNameKeyKeepsAccents() {
        assertThat(CompanyKeys.businessNameKey("Ñandú")).isNotEqualTo(CompanyKeys.businessNameKey("Nandu"));
        assertThat(CompanyKeys.businessNameKey("Ñandú")).isEqualTo(CompanyKeys.businessNameKey("ñANDÚ"));
    }

    @Test
    void businessNameKeyTreatsComposedAndDecomposedAccentsAsTheSameText() {
        // "é" typed as one character or as "e" plus a combining accent.
        assertThat(CompanyKeys.businessNameKey("Café")).isEqualTo(CompanyKeys.businessNameKey("Café"));
    }

    @Test
    void cleansTheTaxIdWithTheDashesOfTheLegalFormat() {
        assertThat(CompanyKeys.cleanTaxId("3101123456")).isEqualTo("3-101-123456");
        assertThat(CompanyKeys.cleanTaxId(" 3 101-123456 ")).isEqualTo("3-101-123456");
        // Anything else is only trimmed, so the format check can reject it.
        assertThat(CompanyKeys.cleanTaxId(" 3101ABC ")).isEqualTo("3101ABC");
        assertThat(CompanyKeys.cleanTaxId("31011234567")).isEqualTo("31011234567");
        assertThat(CompanyKeys.cleanTaxId(null)).isNull();
    }

    @Test
    void taxIdKeyIgnoresDashesAndSpaces() {
        assertThat(CompanyKeys.taxIdKey("3-101-123456")).isEqualTo("3101123456");
        assertThat(CompanyKeys.taxIdKey(" 3 101 123456 ")).isEqualTo("3101123456");
        assertThat(CompanyKeys.taxIdKey("3101abc")).isEqualTo("3101ABC");
        assertThat(CompanyKeys.taxIdKey(null)).isNull();
    }
}
