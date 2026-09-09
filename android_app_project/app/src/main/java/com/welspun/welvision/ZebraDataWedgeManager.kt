package com.welspun.welvision

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.util.Log

/**
 * Zebra DataWedge API Manager for WelVision Industrial Scanner
 * Compatible with Zebra TC21, TC26, TC52, TC53, TC57, TC58, MC3300, and Honeywell Android Scanners.
 */
class ZebraDataWedgeManager(
    private val context: Context,
    private val onBarcodeScanned: (barcode: String, symbology: String) -> Unit
) {
    companion object {
        private const val TAG = "ZebraDataWedge"
        const val PROFILE_NAME = "WelVisionProfile"

        // Zebra DataWedge Intent API Actions
        private const val ACTION_DATAWEDGE = "com.symbol.datawedge.api.ACTION"
        private const val EXTRA_CREATE_PROFILE = "com.symbol.datawedge.api.CREATE_PROFILE"
        private const val EXTRA_SET_CONFIG = "com.symbol.datawedge.api.SET_CONFIG"
        private const val EXTRA_SOFT_SCAN_TRIGGER = "com.symbol.datawedge.api.SOFT_SCAN_TRIGGER"

        // Custom Intent Action configured in DataWedge for WelVision
        const val ACTION_SCAN_RESULT = "com.welspun.welvision.SCAN_RESULT"
        private const val DATAWEDGE_DATA_STRING = "com.symbol.datawedge.data_string"
        private const val DATAWEDGE_LABEL_TYPE = "com.symbol.datawedge.label_type"
    }

    private var isRegistered = false

    private val scanReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.action == ACTION_SCAN_RESULT) {
                val scanData = intent.getStringExtra(DATAWEDGE_DATA_STRING) ?: ""
                val symbology = intent.getStringExtra(DATAWEDGE_LABEL_TYPE) ?: "BARCODE"
                Log.d(TAG, "Hardware Barcode Scanned: $scanData ($symbology)")
                onBarcodeScanned(scanData, symbology)
            }
        }
    }

    /**
     * Register broadcast receiver and configure Zebra DataWedge profile
     */
    fun initialize() {
        if (!isRegistered) {
            val filter = IntentFilter(ACTION_SCAN_RESULT)
            filter.addCategory(Intent.CATEGORY_DEFAULT)
            context.registerReceiver(scanReceiver, filter)
            isRegistered = true
        }
        createDataWedgeProfile()
    }

    /**
     * Unregister receiver when activity stops/destroys
     */
    fun destroy() {
        if (isRegistered) {
            try {
                context.unregisterReceiver(scanReceiver)
            } catch (e: Exception) {
                Log.e(TAG, "Error unregistering receiver: ${e.message}")
            }
            isRegistered = false
        }
    }

    /**
     * Trigger software scanner (simulate physical hardware trigger)
     */
    fun triggerSoftwareScan() {
        val intent = Intent(ACTION_DATAWEDGE).apply {
            putExtra(EXTRA_SOFT_SCAN_TRIGGER, "START_SCANNING")
        }
        context.sendBroadcast(intent)
    }

    /**
     * Automatically provision WelVisionProfile in Zebra DataWedge
     */
    private fun createDataWedgeProfile() {
        // Step 1: Create profile
        val createIntent = Intent(ACTION_DATAWEDGE).apply {
            putExtra(EXTRA_CREATE_PROFILE, PROFILE_NAME)
        }
        context.sendBroadcast(createIntent)

        // Step 2: Configure barcode scanner and intent output
        val profileConfig = Bundle().apply {
            putString("PROFILE_NAME", PROFILE_NAME)
            putString("PROFILE_ENABLED", "true")
            putString("CONFIG_MODE", "UPDATE")

            // Associate with WelVision app package
            val appConfig = Bundle().apply {
                putString("PACKAGE_NAME", context.packageName)
                putStringArray("ACTIVITY_LIST", arrayOf("*"))
            }
            putParcelableArray("APP_LIST", arrayOf(appConfig))

            // Configure Hardware Barcode Plugin
            val barcodeConfig = Bundle().apply {
                putString("PLUGIN_NAME", "BARCODE")
                putString("RESET_CONFIG", "true")
                val barcodeProps = Bundle().apply {
                    putString("scanner_selection", "auto")
                    putString("decoder_qr", "true")
                    putString("decoder_code128", "true")
                    putString("decoder_datamatrix", "true")
                }
                putBundle("PARAM_LIST", barcodeProps)
            }

            // Configure Intent Plugin (Broadcasting scan result to WelVision)
            val intentConfig = Bundle().apply {
                putString("PLUGIN_NAME", "INTENT")
                putString("RESET_CONFIG", "true")
                val intentProps = Bundle().apply {
                    putString("intent_output_enabled", "true")
                    putString("intent_action", ACTION_SCAN_RESULT)
                    putString("intent_delivery", "2") // 2 = Broadcast Intent
                }
                putBundle("PARAM_LIST", intentProps)
            }

            putParcelableArrayList("PLUGIN_CONFIG", arrayListOf(barcodeConfig, intentConfig))
        }

        val setConfigIntent = Intent(ACTION_DATAWEDGE).apply {
            putExtra(EXTRA_SET_CONFIG, profileConfig)
        }
        context.sendBroadcast(setConfigIntent)
        Log.i(TAG, "WelVision DataWedge profile provisioned for package: ${context.packageName}")
    }
}
