package com.mgs.ergomanager.hu;

import org.junit.platform.suite.api.IncludeTags;
import org.junit.platform.suite.api.SelectPackages;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

/**
 * Tests of HU-016, Gestionar disponibilidad: publishing, editing and removing
 * the free slots of an agenda without overlaps.
 */
@Suite
@SuiteDisplayName("HU-016 Gestionar disponibilidad")
@SelectPackages("com.mgs.ergomanager")
@IncludeTags(UserStories.HU_016)
class HU016GestionarDisponibilidad {
}
