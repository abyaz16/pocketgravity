package com.pocketgravity.app

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.webkit.*
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.pocketgravity.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    companion object {
        private const val PREFS_NAME = "pocketgravity_prefs"
        private const val KEY_HOST = "key_host"
        private const val KEY_TOKEN = "key_token"

        // Default hosts: Tailscale VPN and Local Wi-Fi (No VPN)
        private const val DEFAULT_HOST_TAILSCALE = "http://100.85.60.37:8000"
        private const val DEFAULT_HOST_WIFI = "http://192.168.1.4:8000"
        private const val DEFAULT_HOST = DEFAULT_HOST_TAILSCALE
        private const val DEFAULT_TOKEN = "pocketgravity_secret_token_123"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        createNotificationChannel()
        requestNotificationPermission()

        setupWebView()
        setupSwipeRefresh()
        setupErrorActions()
        setupBackNavigation()

        loadPocketGravity()
    }

    private fun createNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val name = "PocketGravity Alerts"
            val descriptionText = "Notifications for Agent responses and laptop battery warnings"
            val importance = android.app.NotificationManager.IMPORTANCE_HIGH
            val channel = android.app.NotificationChannel("pocketgravity_alerts", name, importance).apply {
                description = descriptionText
                enableVibration(true)
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun requestNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) !=
                android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }
    }

    private fun getSavedHost(): String {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_HOST, DEFAULT_HOST) ?: DEFAULT_HOST
    }

    private fun getSavedToken(): String {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_TOKEN, DEFAULT_TOKEN) ?: DEFAULT_TOKEN
    }

    private fun saveConfig(host: String, token: String) {
        val cleanHost = host.trim().removeSuffix("/")
        val cleanToken = token.trim()
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_HOST, cleanHost)
            .putString(KEY_TOKEN, cleanToken)
            .apply()
    }

    private fun buildTargetUrl(): String {
        val host = getSavedHost()
        val token = getSavedToken()
        return "$host/?token=$token&_t=${System.currentTimeMillis()}"
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = binding.webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_NO_CACHE

        // Enable responsive viewport & pinch zoom if needed
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false

        binding.webView.setBackgroundColor(0xFF0B0F19.toInt())

        // Inject Native Javascript Interface Bridge
        binding.webView.addJavascriptInterface(WebAppInterface(this), "AndroidNative")

        binding.webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                binding.progressBar.visibility = View.VISIBLE
                binding.errorOverlay.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                binding.progressBar.visibility = View.GONE
                binding.swipeRefresh.isRefreshing = false
                binding.webView.visibility = View.VISIBLE
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    binding.progressBar.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                    binding.webView.visibility = View.GONE
                    binding.errorOverlay.visibility = View.VISIBLE

                    val currentHost = getSavedHost()
                    val isTailscale = currentHost.contains("100.")

                    if (isTailscale) {
                        binding.txtErrorDetail.text = "Cannot reach Tailscale host ($currentHost).\nIf Tailscale is turned off on your phone, tap below to switch to Local Wi-Fi."
                        binding.btnSwitchWifi.text = "📶 Switch to Local Wi-Fi (192.168.1.4)"
                        binding.btnSwitchWifi.setOnClickListener {
                            saveConfig(DEFAULT_HOST_WIFI, getSavedToken())
                            loadPocketGravity()
                        }
                    } else {
                        binding.txtErrorDetail.text = "Cannot reach Wi-Fi host ($currentHost).\nEnsure your laptop and phone are on the same Wi-Fi network."
                        binding.btnSwitchWifi.text = "🪐 Switch to Tailscale VPN (100.85.60.37)"
                        binding.btnSwitchWifi.setOnClickListener {
                            saveConfig(DEFAULT_HOST_TAILSCALE, getSavedToken())
                            loadPocketGravity()
                        }
                    }
                }
            }
        }

        binding.webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                binding.progressBar.progress = newProgress
                if (newProgress == 100) {
                    binding.progressBar.visibility = View.GONE
                }
            }
        }

        // File download support from workspace file manager
        binding.webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
            try {
                val request = DownloadManager.Request(Uri.parse(url))
                val filename = URLUtil.guessFileName(url, contentDisposition, mimetype)
                request.setMimeType(mimetype)
                request.addRequestHeader("User-Agent", userAgent)
                request.setDescription("Downloading file from PocketGravity...")
                request.setTitle(filename)
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)

                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
                Toast.makeText(this, "Downloading $filename to Downloads folder...", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this, "Download error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupSwipeRefresh() {
        // Disable pull-to-refresh gesture interception so WebView internal chat containers scroll smoothly without freezing
        binding.swipeRefresh.isEnabled = false
    }

    private fun setupErrorActions() {
        binding.btnRetry.setOnClickListener {
            loadPocketGravity()
        }

        binding.btnSwitchWifi.setOnClickListener {
            val currentHost = getSavedHost()
            if (currentHost.contains("100.")) {
                saveConfig(DEFAULT_HOST_WIFI, getSavedToken())
            } else {
                saveConfig(DEFAULT_HOST_TAILSCALE, getSavedToken())
            }
            loadPocketGravity()
        }

        binding.btnConfig.setOnClickListener {
            showConfigDialog()
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    private fun loadPocketGravity() {
        val targetUrl = buildTargetUrl()
        binding.webView.clearCache(true)
        binding.errorOverlay.visibility = View.GONE
        binding.webView.visibility = View.VISIBLE
        binding.progressBar.visibility = View.VISIBLE
        binding.webView.loadUrl(targetUrl)
    }

    private fun showConfigDialog() {
        val layout = LinearLayout(this)
        layout.orientation = LinearLayout.VERTICAL
        layout.setPadding(48, 24, 48, 24)

        val inputHost = EditText(this)
        inputHost.hint = "Host (e.g. http://192.168.1.4:8000)"
        inputHost.setText(getSavedHost())
        layout.addView(inputHost)

        val inputToken = EditText(this)
        inputToken.hint = "Cryptographic Bearer Token"
        inputToken.setText(getSavedToken())
        layout.addView(inputToken)

        // Preset quick switch buttons
        val btnWifiPreset = android.widget.Button(this)
        btnWifiPreset.text = "📶 Set to Local Wi-Fi (192.168.1.4)"
        btnWifiPreset.setOnClickListener {
            inputHost.setText(DEFAULT_HOST_WIFI)
        }
        layout.addView(btnWifiPreset)

        val btnTsPreset = android.widget.Button(this)
        btnTsPreset.text = "🪐 Set to Tailscale (100.85.60.37)"
        btnTsPreset.setOnClickListener {
            inputHost.setText(DEFAULT_HOST_TAILSCALE)
        }
        layout.addView(btnTsPreset)

        AlertDialog.Builder(this)
            .setTitle("PocketGravity Connection")
            .setMessage("Select a network preset or enter custom host IP:")
            .setView(layout)
            .setPositiveButton("Connect") { _, _ ->
                val newHost = inputHost.text.toString().trim()
                val newToken = inputToken.text.toString().trim()
                if (newHost.isNotEmpty()) {
                    saveConfig(newHost, newToken)
                    loadPocketGravity()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
