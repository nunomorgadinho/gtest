package pt.nuvem.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

/** Nuvem para Android: a app web dentro de uma WebView, com envio e transferência de ficheiros. */
public class MainActivity extends Activity {
    private static final int PICK_FILES = 1;
    private static final String PREFS = "nuvem";
    private static final String KEY_SERVER = "server";

    private WebView web;
    private View setup;
    private EditText serverInput;
    private TextView setupError;
    private ProgressBar progress;
    private ValueCallback<Uri[]> fileCallback;
    private String server;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        web = findViewById(R.id.web);
        setup = findViewById(R.id.setup);
        serverInput = findViewById(R.id.server);
        setupError = findViewById(R.id.setup_error);
        progress = findViewById(R.id.progress);

        configureWebView();

        Button connect = findViewById(R.id.connect);
        connect.setOnClickListener(v -> connect());
        serverInput.setOnEditorActionListener((v, actionId, e) -> {
            if (actionId == EditorInfo.IME_ACTION_GO) { connect(); return true; }
            return false;
        });

        if (android.os.Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }

        server = prefs().getString(KEY_SERVER, null);
        if (savedInstanceState != null && server != null) {
            web.restoreState(savedInstanceState);
            showWeb();
        } else if (server != null) {
            openServer();
        } else {
            showSetup(null);
        }
    }

    private SharedPreferences prefs() { return getSharedPreferences(PREFS, MODE_PRIVATE); }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " NuvemAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.addJavascriptInterface(new Bridge(), "NuvemApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                Uri base = Uri.parse(server);
                // Ligações externas abrem no browser; as da Nuvem ficam na app.
                if (u.getHost() != null && u.getHost().equals(base.getHost())
                        && u.getPort() == base.getPort() && !u.getPath().startsWith("/s/")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) { progress.setVisibility(View.VISIBLE); }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) {
                    showSetup("Não foi possível ligar a " + server + " (" + err.getDescription() + ").");
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) { progress.setProgress(p); }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try {
                    startActivityForResult(Intent.createChooser(i, "Escolher ficheiros"), PICK_FILES);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, length) -> {
            try {
                String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
                r.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url));
                r.addRequestHeader("User-Agent", userAgent);
                r.setMimeType(mimeType);
                r.setTitle(name);
                r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(r);
                Toast.makeText(this, "A transferir " + name, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Não foi possível transferir o ficheiro", Toast.LENGTH_LONG).show();
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_FILES || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                result = new Uri[n];
                for (int i = 0; i < n; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    private void connect() {
        String url = serverInput.getText().toString().trim();
        if (url.isEmpty()) { showSetup("Escreve o endereço do servidor."); return; }
        if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
        while (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        if (!URLUtil.isValidUrl(url)) { showSetup("Endereço inválido."); return; }
        server = url;
        prefs().edit().putString(KEY_SERVER, server).apply();
        openServer();
    }

    private void openServer() {
        showWeb();
        web.loadUrl(server + "/");
    }

    private void showWeb() {
        setup.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
    }

    private void showSetup(String error) {
        progress.setVisibility(View.GONE);
        web.setVisibility(View.GONE);
        setup.setVisibility(View.VISIBLE);
        serverInput.setText(server != null ? server : BuildConfig.DEFAULT_SERVER);
        serverInput.setSelection(serverInput.getText().length());
        setupError.setVisibility(error == null ? View.GONE : View.VISIBLE);
        if (error != null) setupError.setText(error);
    }

    private void handleBack() {
        if (setup.getVisibility() == View.VISIBLE && server != null && web.getUrl() != null) { showWeb(); return; }
        // Primeiro deixa a app web fechar diálogos/pré-visualizações; depois volta atrás no histórico.
        web.evaluateJavascript("window.nuvemBack ? window.nuvemBack() : false", value -> {
            if ("true".equals(value)) return;
            if (web.canGoBack()) web.goBack();
            else finish();
        });
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() { handleBack(); }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    /** Funções que a app web pode chamar quando corre dentro da APK. */
    public class Bridge {
        @JavascriptInterface
        public void changeServer() { runOnUiThread(() -> showSetup(null)); }

        @JavascriptInterface
        public String version() { return BuildConfig.VERSION_NAME; }
    }
}
