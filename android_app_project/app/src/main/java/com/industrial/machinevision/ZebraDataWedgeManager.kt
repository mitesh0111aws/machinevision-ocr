package com.industrial.machineocr.zebra

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.util.Log

/**
 * Zebra DataWedge API Manager
 * Interacts with Zebra's proprietary DataWedge service on TC21, TC26, TC52, TC57, TC53, TC58.
 * 
 * Features:
 * 1. Automatically provisions "ShopFloorOCR" DataWedge profile on app launch.
 * 2. Receives machine asset barcode scans (QR / DataMatrix / Code128) via Intent broadcast.
 * 3. Controls hardware scanner trigger programmatically via DataWedge API.
 */
class ZebraDataWedgeManager(
    private val context: Context,
    private val onBarcodeScanned: (barcode: String, sym: String) -> Unit
) {
    companion object {
        private const val TAG = "ZebraDataWedge"
        const val PROFILE_NAME = "ShopFloorOCR"
        
        // Zebra DataWedge Intent Actions
        private const val ACTION_DATAWEDGE = "com.symbol.datawedge.api.ACTION"
        private const val EXTRA_CREATE_PROFILE = "com.symbol.datawedge.api.CREATE_PROFILE"
        private const val EXTRA_SET_CONFIG = "com.symbol.datawedge.api.SET_CONFIG"
        private const val EXTRA_SOFT_SCAN_TRIGGER = "com.symbol.datawedge.api.SOFT_SCAN_TRIGGER"
        
        // Custom Intent Action configured in DataWedge for this app
        const val ACTION_SCAN_RESULT = "com.industrial.machineocr.SCAN_RESULT"
        private const val DATAWEDGE_DATA_STRING = "com.symbol.datawedge.data_string"
        private const val DATAWEDGE_LABEL_TYPE = "com.symbol.datawedge.label_type"
    }

    private val scanReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.action == ACTION_SCAN_RESULT) {
                val scanData = intent.getStringExtra(DATAWEDGE_DATA_STRING) ?: ""
                val symbology = intent.getStringExtra(DATAWEDGE_LABEL_TYPE) ?: ""
                Log.d(TAG, "Barcode Scanned: $scanData (Symbology: $symbology)")
                onBarcodeScanned(scanData, symbology)
            }
        }
    }

    /**
     * Register broadcast receiver and configure Zebra DataWedge profile
     */
    fun initialize() {
        val filter = IntentFilter(ACTION_SCAN_RESULT)
        context.registerReceiver(scanReceiver, filter)
        createDataWedgeProfile()
    }

    /**
     * Unregister receiver on Activity destroy
     */
    fun destroy() {
        try {
            context.unregisterReceiver(scanReceiver)
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering receiver", e)
        }
    }

    /**
     * Trigger Zebra hardware imager programmatically
     */
    fun triggerHardwareScan() {
        val intent = Intent(ACTION_DATAWEDGE).apply {
            putExtra(EXTRA_SOFT_SCAN_TRIGGER, "TOGGLE_SCANNING")
        }
        context.sendBroadcast(intent)
    }

    /**
     * Creates and configures the DataWedge profile to send scanned barcodes to this app
     */
    private fun createDataWedgeProfile() {
        // 1. Create Profile
        val createIntent = Intent(ACTION_DATAWEDGE).apply {
            putExtra(EXTRA_CREATE_PROFILE, PROFILE_NAME)
        }
        context.sendBroadcast(createIntent)

        // 2. Associate Profile with App Package and Activity
        val appConfig = Bundle().apply {
            putString("PACKAGE_NAME", context.packageName)
            putStringArray("ACTIVITY_LIST", arrayOf("*"))
        }

        // 3. Configure Barcode Input plugin
        val barcodeConfig = Bundle().apply {
            putString("PLUGIN_NAME", "BARCODE")
            putString("RESET_CONFIG", "true")
            val paramList = Bundle().apply {
                putString("scanner_selection", "auto")
                putString("decoder_qrcode", "true")
                putString("decoder_datamatrix", "true")
                putString("decoder_code128", "true")
            }
            putBundle("PARAM_LIST", paramList)
        }

        // 4. Configure Intent Output plugin (broadcasts to our receiver)
        val intentConfig = Bundle().apply {
            putString("PLUGIN_NAME", "INTENT")
            putString("RESET_CONFIG", "true")
            val paramList = Bundle().apply {
                putString("intent_output_enabled", "true")
                putString("intent_action", ACTION_SCAN_RESULT)
                putString("intent_delivery", "2") // 2 = Broadcast Intent
            }
            putBundle("PARAM_LIST", paramList)
        }

        // 5. Send SET_CONFIG to DataWedge
        val setConfigIntent = Intent(ACTION_DATAWEDGE).apply {
            val mainBundle = Bundle().apply {
                putString("PROFILE_NAME", PROFILE_NAME)
                putString("PROFILE_ENABLED", "true")
                putString("CONFIG_MODE", "CREATE_IF_NOT_EXIST")
                putParcelableArray("APP_LIST", arrayOf(appConfig))
                putParcelableArrayList("PLUGIN_CONFIG", arrayListOf(barcodeConfig, intentConfig))
            }
            putExtra(EXTRA_SET_CONFIG, mainBundle)
        }
        context.sendBroadcast(setConfigIntent)
        Log.i(TAG, "Zebra DataWedge profile '$PROFILE_NAME' successfully configured")
    }
}
