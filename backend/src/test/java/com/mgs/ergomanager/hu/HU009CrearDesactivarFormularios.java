package com.mgs.ergomanager.hu;

import org.junit.platform.suite.api.IncludeTags;
import org.junit.platform.suite.api.SelectPackages;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

/**
 * Tests of HU-009, Crear y desactivar formularios: self evaluation and
 * personalized evaluation forms, their questions, activation and deactivation.
 */
@Suite
@SuiteDisplayName("HU-009 Crear y desactivar formularios")
@SelectPackages("com.mgs.ergomanager")
@IncludeTags(UserStories.HU_009)
class HU009CrearDesactivarFormularios {
}
