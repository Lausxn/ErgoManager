<?xml version="1.0" encoding="UTF-8"?>
<!--
    Copy of the surefire report of one user story suite (profile hu-reports) named
    after the story, without the system properties and the captured console logs,
    which hold local paths. Failures and errors keep their message and stack trace.
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="xml" encoding="UTF-8" indent="yes"/>
    <xsl:strip-space elements="*"/>
    <xsl:param name="title"/>

    <xsl:template match="@* | node()">
        <xsl:copy>
            <xsl:apply-templates select="@* | node()"/>
        </xsl:copy>
    </xsl:template>

    <xsl:template match="/testsuite/@name">
        <xsl:attribute name="name">
            <xsl:value-of select="$title"/>
        </xsl:attribute>
    </xsl:template>

    <xsl:template match="properties | system-out | system-err"/>
</xsl:stylesheet>
