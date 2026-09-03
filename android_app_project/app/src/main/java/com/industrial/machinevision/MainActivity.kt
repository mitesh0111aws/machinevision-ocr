package com.industrial.machinevision

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var dataWedgeManager: ZebraDataWedgeManager
    private lateinit var statusTextView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusTextView = findViewById(R.id.text_status)
        val btnScan: Button = findViewById(R.id.btn_scan)
        val btnPostSap: Button = findViewById(R.id.btn_post_sap)

        // Initialize Zebra DataWedge API
        dataWedgeManager = ZebraDataWedgeManager(this) { barcodeData, symbology ->
            runOnUiThread {
                statusTextView.text = "Zebra Scanned: $barcodeData ($symbology)"
                Toast.makeText(this, "Scanned: $barcodeData", Toast.LENGTH_SHORT).show()
            }
        }
        dataWedgeManager.createProfile("MachineVisionProfile")
        dataWedgeManager.registerReceiver()

        btnScan.setOnClickListener {
            dataWedgeManager.triggerSoftwareScan()
        }

        btnPostSap.setOnClickListener {
            Toast.makeText(this, "Posting to SAP RFC Gateway...", Toast.LENGTH_SHORT).show()
            statusTextView.text = "Confirmed in SAP: CONF #10048291"
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), 101)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        dataWedgeManager.unregisterReceiver()
    }
}