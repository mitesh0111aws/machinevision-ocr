package com.welspun.welvision

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.view.View
import android.webkit.*
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    companion object {
        private const val PREFS_NAME = "WelVisionPrefs"
        private const val KEY_SERVER_URL = "server_url"
        const val DEFAULT_CLOUD_URL = "https://machinevision-ocr.vercel.app"
        const val DEFAULT_EMULATOR_URL = "http://10.0.2.2:5050"
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var offlineContainer: LinearLayout
    private lateinit var textErrorDetails: TextView
    private lateinit var btnSettings: ImageButton
    private lateinit var btnRefresh: ImageButton
    private lateinit var btnRetry: Button
    private lateinit var btnChangeServer: Button
    private lateinit var scannerStatusBadge: TextView

    private lateinit var dataWedgeManager: ZebraDataWedgeManager
    private lateinit var prefs: SharedPreferences

    // Camera file upload handling
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var cameraImageUri: Uri? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val intentData = result.data
            val results: Array<Uri>? = when {
                intentData?.data != null -> arrayOf(intentData.data!!)
                cameraImageUri != null -> arrayOf(cameraImageUri!!)
                else -> null
            }
            fileUploadCallback?.onReceiveValue(results)
        } else {
            fileUploadCallback?.onReceiveValue(null)
        }
        fileUploadCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        webView = findViewById(R.id.webview)
        progressBar = findViewById(R.id.progress_bar)
        offlineContainer = findViewById(R.id.offline_container)
        textErrorDetails = findViewById(R.id.text_error_details)
        btnSettings = findViewById(R.id.btn_settings)
        btnRefresh = findViewById(R.id.btn_refresh)
        btnRetry = findViewById(R.id.btn_retry)
        btnChangeServer = findViewById(R.id.btn_change_server)
        scannerStatusBadge = findViewById(R.id.scanner_status_badge)

        setupZebraDataWedge()
        setupWebView()
        setupButtons()
        checkPermissions()

        loadCurrentServer()
    }

    private fun setupZebraDataWedge() {
        dataWedgeManager = ZebraDataWedgeManager(this) { barcodeData, symbology ->
            runOnUiThread {
                Toast.makeText(this, "Scanned: $barcodeData ($symbology)", Toast.LENGTH_SHORT).show()
                // Inject barcode directly into the WelVision Web UI search or active input
                val js = "if (window.handleZebraHardwareScan) { window.handleZebraHardwareScan('$barcodeData', '$symbology'); } else { console.log('Zebra barcode: $barcodeData'); }"
                webView.evaluateJavascript(js, null)
            }
        }
        dataWedgeManager.initialize()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mediaPlaybackRequiresUserGesture = false

        // Custom User Agent identifier
        settings.userAgentString = "${settings.userAgentString} WelVision-ZebraScanner-Android"

        // Expose native bridge to web JavaScript
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidZebra")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
                offlineContainer.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    showOfflineError("Failed to connect to ${getCurrentServerUrl()}: ${error?.description}")
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                if (newProgress == 100) progressBar.visibility = View.GONE
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                // Auto grant camera permissions for WebRTC live camera viewfinder
                runOnUiThread {
                    request?.grant(request.resources)
                }
            }

            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                launchCameraOrGalleryIntent()
                return true
            }
        }
    }

    private fun launchCameraOrGalleryIntent() {
        val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        try {
            val photoFile = createTempImageFile()
            cameraImageUri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                photoFile
            )
            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri)
        } catch (ex: Exception) {
            cameraImageUri = null
        }

        val contentSelectionIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*"
        }

        val intentArray: Array<Intent> = if (takePictureIntent.resolveActivity(packageManager) != null && cameraImageUri != null) {
            arrayOf(takePictureIntent)
        } else {
            emptyArray()
        }

        val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
            putExtra(Intent.EXTRA_INTENT, contentSelectionIntent)
            putExtra(Intent.EXTRA_TITLE, "Capture Screen or Choose Image")
            putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray)
        }

        fileChooserLauncher.launch(chooserIntent)
    }

    private fun createTempImageFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir = cacheDir
        return File.createTempFile("WELVISION_${timeStamp}_", ".jpg", storageDir)
    }

    private fun setupButtons() {
        btnRefresh.setOnClickListener {
            webView.reload()
        }

        btnSettings.setOnClickListener {
            showServerConfigDialog()
        }

        btnRetry.setOnClickListener {
            loadCurrentServer()
        }

        btnChangeServer.setOnClickListener {
            showServerConfigDialog()
        }
    }

    private fun loadCurrentServer() {
        val url = getCurrentServerUrl()
        offlineContainer.visibility = View.GONE
        webView.visibility = View.VISIBLE
        webView.loadUrl(url)
    }

    private fun getCurrentServerUrl(): String {
        return prefs.getString(KEY_SERVER_URL, DEFAULT_CLOUD_URL) ?: DEFAULT_CLOUD_URL
    }

    private fun setServerUrl(url: String) {
        val cleanUrl = if (!url.startsWith("http://") && !url.startsWith("https://")) {
            "http://$url"
        } else {
            url
        }
        prefs.edit().putString(KEY_SERVER_URL, cleanUrl).apply()
        loadCurrentServer()
        Toast.makeText(this, "Connected to: $cleanUrl", Toast.LENGTH_SHORT).show()
    }

    private fun showServerConfigDialog() {
        val input = EditText(this).apply {
            setText(getCurrentServerUrl())
            setSelection(text.length)
            hint = "http://192.168.1.100:5050"
        }

        AlertDialog.Builder(this)
            .setTitle("WelVision Server Address")
            .setMessage("Select quick preset or enter custom server URL:")
            .setView(input)
            .setPositiveButton("Save & Connect") { _, _ ->
                val newUrl = input.text.toString().trim()
                if (newUrl.isNotEmpty()) setServerUrl(newUrl)
            }
            .setNegativeButton("Cancel", null)
            .setNeutralButton("Presets") { _, _ ->
                showPresetPickerDialog()
            }
            .show()
    }

    private fun showPresetPickerDialog() {
        val presets = arrayOf(
            "Cloud Production (Vercel): $DEFAULT_CLOUD_URL",
            "Android Emulator Local: $DEFAULT_EMULATOR_URL",
            "Local Mill Wi-Fi: http://192.168.1.100:5050"
        )
        val urls = arrayOf(
            DEFAULT_CLOUD_URL,
            DEFAULT_EMULATOR_URL,
            "http://192.168.1.100:5050"
        )

        AlertDialog.Builder(this)
            .setTitle("Select Server Preset")
            .setItems(presets) { _, which ->
                setServerUrl(urls[which])
            }
            .show()
    }

    private fun showOfflineError(message: String) {
        runOnUiThread {
            progressBar.visibility = View.GONE
            webView.visibility = View.GONE
            offlineContainer.visibility = View.VISIBLE
            textErrorDetails.text = message
        }
    }

    private fun checkPermissions() {
        val permissions = mutableListOf(Manifest.permission.CAMERA)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES)
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }

        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), 101)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        dataWedgeManager.destroy()
    }

    inner class WebAppInterface(private val context: Context) {
        @JavascriptInterface
        fun triggerLaserScan() {
            runOnUiThread {
                dataWedgeManager.triggerSoftwareScan()
            }
        }

        @JavascriptInterface
        fun showNativeToast(message: String) {
            runOnUiThread {
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            }
        }
    }
}
