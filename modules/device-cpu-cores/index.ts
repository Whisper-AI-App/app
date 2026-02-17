import DeviceCpuCoresModule from "./src/DeviceCpuCoresModule";

export function getCoreCount(): number {
  return DeviceCpuCoresModule.getCoreCount();
}
