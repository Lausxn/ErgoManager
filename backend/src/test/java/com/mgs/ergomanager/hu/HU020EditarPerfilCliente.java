package com.mgs.ergomanager.hu;

import org.junit.platform.suite.api.IncludeTags;
import org.junit.platform.suite.api.SelectPackages;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

/**
 * Tests of HU-020, Editar perfil de cliente: editing the company profile,
 * history of its previous names and reports found by them.
 */
@Suite
@SuiteDisplayName("HU-020 Editar perfil de cliente")
@SelectPackages("com.mgs.ergomanager")
@IncludeTags(UserStories.HU_020)
class HU020EditarPerfilCliente {
}
