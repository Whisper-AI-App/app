import { registerWebModule } from "expo";

class DeviceCpuCoresModule {
  getCoreCount(): number {
    return navigator.hardwareConcurrency ?? 4;
  }
}

export default registerWebModule(DeviceCpuCoresModule, "DeviceCpuCoresModule");
