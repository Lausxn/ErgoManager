package com.mgs.ergomanager.model;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.util.HexFormat;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Comparison keys that keep the business name and the tax id of the client
 * companies unique, whatever the way they were typed.
 *
 * <ul>
 *   <li>Business name: case and repeated spaces are ignored, accents are not,
 *       so "ACME  s.a." repeats "Acme S.A." but "Ñandú" differs from "Nandu".</li>
 *   <li>Tax id: dashes and spaces are ignored, so "3-101-123456" repeats
 *       "3101123456".</li>
 * </ul>
 */
public final class CompanyKeys {

    /** Name of the unique constraint over the business name key. */
    public static final String BUSINESS_NAME_CONSTRAINT = "uk_companies_business_name_key";

    /** Name of the unique constraint over the tax id key. */
    public static final String TAX_ID_CONSTRAINT = "uk_companies_tax_id_key";

    private static final Pattern SPACES = Pattern.compile("\\s+");
    private static final Pattern TAX_ID_SEPARATORS = Pattern.compile("[\\s-]+");

    private CompanyKeys() {
    }

    /**
     * Cleans a business name the way it is stored: trimmed, with single spaces
     * between words and with accents in their composed form.
     *
     * @param businessName name typed by the user, may be null
     * @return clean name, or null when the name is null
     */
    public static String cleanBusinessName(String businessName) {
        if (businessName == null) {
            return null;
        }
        return SPACES.matcher(Normalizer.normalize(businessName, Normalizer.Form.NFC).trim()).replaceAll(" ");
    }

    /**
     * Builds the key that identifies a business name. It is a SHA-256 hash of
     * the clean name in lower case: MySQL compares text ignoring accents, so
     * storing the name itself would make "Ñandú" and "Nandu" collide, while
     * the hexadecimal hash is compared the same way on every database.
     *
     * @param businessName name of the company, may be null
     * @return 64 hexadecimal characters, or null when the name is null
     */
    public static String businessNameKey(String businessName) {
        String clean = cleanBusinessName(businessName);
        if (clean == null) {
            return null;
        }
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(clean.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            // Every Java runtime ships SHA-256.
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    /**
     * Builds the key that identifies a tax id: the value without dashes or
     * spaces and in upper case.
     *
     * @param taxId tax id of the company, may be null
     * @return comparable tax id, or null when the tax id is null
     */
    public static String taxIdKey(String taxId) {
        if (taxId == null) {
            return null;
        }
        return TAX_ID_SEPARATORS.matcher(taxId).replaceAll("").toUpperCase(Locale.ROOT);
    }
}
