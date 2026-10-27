package com.mgs.ergomanager.hu;

import org.junit.platform.suite.api.IncludeTags;
import org.junit.platform.suite.api.SelectPackages;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

/**
 * Tests of HU-021, Desactivar perfil de cliente: deactivating and reactivating
 * a company and what an inactive company can no longer be used for.
 */
@Suite
@SuiteDisplayName("HU-021 Desactivar perfil de cliente")
@SelectPackages("com.mgs.ergomanager")
@IncludeTags(UserStories.HU_021)
class HU021DesactivarPerfilCliente {
}
