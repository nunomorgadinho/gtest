package pt.widgilabs.controladorsonhos;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Ecrã único da app: o jogo corre num canvas HTML a partir de assets/index.html.
 * O recorde e as noites desbloqueadas ficam no localStorage do WebView.
 */
public class MainActivity extends Activity {

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(0x00000000);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        // Deixa a música começar sem exigir um toque prévio.
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new Bridge(), "AndroidApp");

        setContentView(webView);

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("file:///android_asset/index.html");
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        // Avisa a app que foi para segundo plano (pausa o jogo e silencia o som).
        webView.evaluateJavascript("window.appPausa && window.appPausa()", null);
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        webView.evaluateJavascript("window.appRetoma && window.appRetoma()", null);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // Deixa a app decidir: pausa o jogo ou volta ao menu.
        webView.evaluateJavascript("window.handleBack ? window.handleBack() : false", value -> {
            if (!"true".equals(value)) {
                MainActivity.super.onBackPressed();
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    /** Ponte JS para partilhar o resultado através das apps instaladas. */
    private class Bridge {
        @JavascriptInterface
        public void share(String text) {
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(send, getString(R.string.share_title)));
            });
        }
    }
}
