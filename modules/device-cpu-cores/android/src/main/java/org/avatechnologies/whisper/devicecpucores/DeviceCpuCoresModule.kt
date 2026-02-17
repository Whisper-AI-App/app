package org.avatechnologies.whisper.devicecpucores

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DeviceCpuCoresModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DeviceCpuCores")

    Function("getCoreCount") {
      Runtime.getRuntime().availableProcessors()
    }
  }
}
