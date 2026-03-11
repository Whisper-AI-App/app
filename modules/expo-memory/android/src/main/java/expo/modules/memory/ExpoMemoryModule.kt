package expo.modules.memory

import android.app.ActivityManager
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoMemoryModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoMemory")

        AsyncFunction("getAvailableMemory") {
            val activityManager = appContext.reactContext?.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            if (activityManager != null) {
                val memInfo = ActivityManager.MemoryInfo()
                activityManager.getMemoryInfo(memInfo)
                memInfo.availMem.toDouble()
            } else {
                -1.0
            }
        }
    }
}
