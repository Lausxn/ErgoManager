<?xml version="1.0" encoding="UTF-8"?>
<!--
    Readable summary of the surefire report of one user story suite (profile hu-reports).
    Lists every test with its result; failures and errors show their message.
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="text" encoding="UTF-8"/>
    <xsl:param name="title"/>

    <xsl:template match="/testsuite">
        <xsl:variable name="failed" select="@failures + @errors"/>
        <xsl:value-of select="$title"/>
        <xsl:text>&#10;</xsl:text>
        <xsl:text>===============================================================================&#10;</xsl:text>
        <xsl:text>Resultado: </xsl:text>
        <xsl:choose>
            <xsl:when test="$failed = 0">APROBADA</xsl:when>
            <xsl:otherwise>CON FALLAS</xsl:otherwise>
        </xsl:choose>
        <xsl:text>&#10;Pruebas: </xsl:text>
        <xsl:value-of select="@tests"/>
        <xsl:text> | Exitosas: </xsl:text>
        <xsl:value-of select="@tests - $failed - @skipped"/>
        <xsl:text> | Fallidas: </xsl:text>
        <xsl:value-of select="@failures"/>
        <xsl:text> | Errores: </xsl:text>
        <xsl:value-of select="@errors"/>
        <xsl:text> | Omitidas: </xsl:text>
        <xsl:value-of select="@skipped"/>
        <xsl:text> | Tiempo: </xsl:text>
        <xsl:value-of select="format-number(@time, '0.00')"/>
        <xsl:text> s&#10;</xsl:text>
        <xsl:text>===============================================================================&#10;</xsl:text>
        <xsl:for-each select="testcase">
            <xsl:sort select="@classname"/>
            <xsl:sort select="@name"/>
            <xsl:variable name="class">
                <xsl:call-template name="simple-name">
                    <xsl:with-param name="name" select="@classname"/>
                </xsl:call-template>
            </xsl:variable>
            <xsl:choose>
                <xsl:when test="failure">[FALLA]   </xsl:when>
                <xsl:when test="error">[ERROR]   </xsl:when>
                <xsl:when test="skipped">[OMITIDA] </xsl:when>
                <xsl:otherwise>[OK]      </xsl:otherwise>
            </xsl:choose>
            <xsl:value-of select="$class"/>
            <xsl:text> &gt; </xsl:text>
            <xsl:value-of select="@name"/>
            <xsl:text> (</xsl:text>
            <xsl:value-of select="format-number(@time, '0.000')"/>
            <xsl:text> s)&#10;</xsl:text>
            <xsl:for-each select="failure | error">
                <xsl:text>          </xsl:text>
                <xsl:value-of select="normalize-space(@message)"/>
                <xsl:text>&#10;</xsl:text>
            </xsl:for-each>
        </xsl:for-each>
    </xsl:template>

    <!-- com.mgs.ergomanager.api.CompanyIntegrationTests -> CompanyIntegrationTests -->
    <xsl:template name="simple-name">
        <xsl:param name="name"/>
        <xsl:choose>
            <xsl:when test="contains($name, '.')">
                <xsl:call-template name="simple-name">
                    <xsl:with-param name="name" select="substring-after($name, '.')"/>
                </xsl:call-template>
            </xsl:when>
            <xsl:otherwise>
                <xsl:value-of select="$name"/>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>
</xsl:stylesheet>
