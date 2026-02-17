import { requireNativeModule } from "expo";

declare class DeviceCpuCoresModule {
  getCoreCount(): number;
}

export default requireNativeModule<DeviceCpuCoresModule>("DeviceCpuCores");
