package com.mgs.ergomanager.hu;

import org.junit.platform.suite.api.IncludeTags;
import org.junit.platform.suite.api.SelectPackages;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

/**
 * Tests of HU-003, Crear perfil de cliente: creation of the company profile,
 * format and uniqueness of its name and tax id.
 */
@Suite
@SuiteDisplayName("HU-003 Crear perfil de cliente")
@SelectPackages("com.mgs.ergomanager")
@IncludeTags(UserStories.HU_003)
class HU003CrearPerfilCliente {
}
