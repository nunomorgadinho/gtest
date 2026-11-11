package pt.widgilabs.pedrapapelinfinito;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.window.OnBackInvokedDispatcher;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.util.ArrayList;

/**
 * Ecrã único da app: o jogo corre em HTML/CSS/JS a partir de assets/index.html.
 * O árbitro chama a API da Anthropic diretamente do WebView, com a chave do jogador.
 */
public class MainActivity extends Activity {

    private static final int PEDIDO_VOZ = 42;
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(0xFFFFF6E0);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new Bridge(), "AndroidApp");

        setContentView(webView);

        // Android 15+: a app ocupa o ecrã todo (edge-to-edge). Deixa espaço para as barras
        // do sistema e para o teclado, para nada ficar escondido por baixo delas.
        if (Build.VERSION.SDK_INT >= 35) {
            webView.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left, i.top, i.right, i.bottom);
                return WindowInsets.CONSUMED;
            });
        }

        // Android 13+: botão "voltar" com o sistema novo (com alvo API 36 o onBackPressed deixa de ser chamado).
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::tratarVoltar);
        }

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
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PEDIDO_VOZ) return;
        String texto = "";
        if (resultCode == RESULT_OK && data != null) {
            ArrayList<String> resultados = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (resultados != null && !resultados.isEmpty()) texto = resultados.get(0);
        }
        webView.evaluateJavascript("window.recebeVoz && window.recebeVoz(" + JSONObject.quote(texto) + ")", null);
    }

    /** Deixa o jogo decidir: fecha janelas abertas ou volta ao início; se não houver nada a fazer, sai. */
    private void tratarVoltar() {
        webView.evaluateJavascript("window.handleBack ? window.handleBack() : false", value -> {
            if (!"true".equals(value)) {
                finish();
            }
        });
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // Só usado em Android 12 ou anterior.
        tratarVoltar();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    /** Ponte JS: partilhar resultados e reconhecimento de voz. */
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

        @JavascriptInterface
        public boolean vozDisponivel() {
            Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            return i.resolveActivity(getPackageManager()) != null;
        }

        @JavascriptInterface
        public void ouvir(String pergunta) {
            runOnUiThread(() -> {
                Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-PT");
                i.putExtra(RecognizerIntent.EXTRA_PROMPT, pergunta == null || pergunta.isEmpty() ? getString(R.string.voz_prompt) : pergunta);
                i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                try {
                    startActivityForResult(i, PEDIDO_VOZ);
                } catch (ActivityNotFoundException e) {
                    webView.evaluateJavascript("window.vozIndisponivel && window.vozIndisponivel()", null);
                }
            });
        }
    }
}
