import ExpoModulesCore

public class ExpoMemoryModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ExpoMemory")

        AsyncFunction("getAvailableMemory") { () -> Double in
            return Double(os_proc_available_memory())
        }
    }
}
