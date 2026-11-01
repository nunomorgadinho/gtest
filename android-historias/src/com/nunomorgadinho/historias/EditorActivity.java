package com.nunomorgadinho.historias;

import android.app.ActionBar;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Menu;
import android.view.MenuItem;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

/** Editor de uma história. Guarda automaticamente ao sair. */
public class EditorActivity extends Activity {
    static final String EXTRA_ID = "story_id";
    private static final String STATE_ID = "state_id";

    private StoryDb db;
    private EditText title;
    private EditText body;
    private TextView meta;
    private long id = -1;
    private String savedTitle = "";
    private String savedBody = "";
    private boolean deleted;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_editor);
        db = new StoryDb(this);
        title = (EditText) findViewById(R.id.title);
        body = (EditText) findViewById(R.id.body);
        meta = (TextView) findViewById(R.id.meta);

        id = savedInstanceState != null
                ? savedInstanceState.getLong(STATE_ID, -1)
                : getIntent().getLongExtra(EXTRA_ID, -1);

        if (id >= 0) {
            Story s = db.get(id);
            if (s != null) {
                savedTitle = s.title;
                savedBody = s.body;
                if (savedInstanceState == null) {
                    title.setText(s.title);
                    body.setText(s.body);
                }
            } else {
                id = -1;
            }
        }

        ActionBar bar = getActionBar();
        if (bar != null) {
            bar.setDisplayHomeAsUpEnabled(true);
            bar.setTitle(id >= 0 ? R.string.edit_story : R.string.new_story);
        }

        if (id < 0 && savedInstanceState == null) {
            title.requestFocus();
            getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE
                    | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        } else if (savedInstanceState == null) {
            body.requestFocus();
            body.setSelection(body.length());
        }

        TextWatcher watcher = new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(Editable s) { updateMeta(); }
        };
        title.addTextChangedListener(watcher);
        body.addTextChangedListener(watcher);
        updateMeta();
    }

    private void updateMeta() {
        int words = Story.countWords(body.getText().toString());
        int chars = body.length();
        int minutes = Math.max(1, Math.round(words / 200f));
        String text = words + (words == 1 ? " palavra" : " palavras")
                + "  ·  " + chars + (chars == 1 ? " carácter" : " caracteres");
        if (words > 0) text += "  ·  ~" + minutes + " min de leitura";
        meta.setText(text);
    }

    private void save() {
        if (deleted) return;
        String t = title.getText().toString();
        String b = body.getText().toString();
        boolean blank = t.trim().isEmpty() && b.trim().isEmpty();

        if (id < 0) {
            if (blank) return;
            id = db.insert(t, b);
        } else if (blank) {
            db.delete(id);
            id = -1;
        } else if (!t.equals(savedTitle) || !b.equals(savedBody)) {
            db.update(id, t, b);
        } else {
            return;
        }
        savedTitle = t;
        savedBody = b;
    }

    @Override
    protected void onPause() {
        super.onPause();
        save();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        save();
        super.onSaveInstanceState(out);
        out.putLong(STATE_ID, id);
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.editor, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        int itemId = item.getItemId();
        if (itemId == android.R.id.home) {
            finish();
            return true;
        } else if (itemId == R.id.action_share) {
            share();
            return true;
        } else if (itemId == R.id.action_delete) {
            confirmDelete();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void share() {
        String t = title.getText().toString().trim();
        String b = body.getText().toString();
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        if (!t.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, t);
        send.putExtra(Intent.EXTRA_TEXT, t.isEmpty() ? b : t + "\n\n" + b);
        startActivity(Intent.createChooser(send, getString(R.string.share_with)));
    }

    private void confirmDelete() {
        new AlertDialog.Builder(this)
                .setMessage(R.string.delete_confirm)
                .setPositiveButton(R.string.delete, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int which) {
                        if (id >= 0) db.delete(id);
                        deleted = true;
                        Toast.makeText(EditorActivity.this, R.string.deleted, Toast.LENGTH_SHORT).show();
                        finish();
                    }
                })
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    @Override
    protected void onDestroy() {
        db.close();
        super.onDestroy();
    }
}
