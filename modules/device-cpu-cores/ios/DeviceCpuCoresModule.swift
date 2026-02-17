import ExpoModulesCore

public class DeviceCpuCoresModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DeviceCpuCores")

    Function("getCoreCount") {
      return ProcessInfo.processInfo.activeProcessorCount
    }
  }
}
