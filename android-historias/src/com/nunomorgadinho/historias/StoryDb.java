package com.nunomorgadinho.historias;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.util.ArrayList;
import java.util.List;

/** Armazenamento local das histórias em SQLite. */
final class StoryDb extends SQLiteOpenHelper {
    private static final String TABLE = "stories";
    private static final String[] COLS = {"_id", "title", "body", "created", "updated"};

    StoryDb(Context context) {
        super(context.getApplicationContext(), "historias.db", null, 1);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE " + TABLE + " ("
                + "_id INTEGER PRIMARY KEY AUTOINCREMENT, "
                + "title TEXT NOT NULL DEFAULT '', "
                + "body TEXT NOT NULL DEFAULT '', "
                + "created INTEGER NOT NULL, "
                + "updated INTEGER NOT NULL)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Sem migrações por agora.
    }

    List<Story> list(String query) {
        String selection = null;
        String[] args = null;
        if (query != null && !query.trim().isEmpty()) {
            String like = "%" + query.trim().replace("\\", "\\\\")
                    .replace("%", "\\%").replace("_", "\\_") + "%";
            selection = "title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\'";
            args = new String[]{like, like};
        }
        List<Story> out = new ArrayList<Story>();
        Cursor c = getReadableDatabase().query(TABLE, COLS, selection, args,
                null, null, "updated DESC");
        try {
            while (c.moveToNext()) out.add(read(c));
        } finally {
            c.close();
        }
        return out;
    }

    Story get(long id) {
        Cursor c = getReadableDatabase().query(TABLE, COLS, "_id = ?",
                new String[]{String.valueOf(id)}, null, null, null);
        try {
            return c.moveToFirst() ? read(c) : null;
        } finally {
            c.close();
        }
    }

    long insert(String title, String body) {
        long now = System.currentTimeMillis();
        ContentValues v = new ContentValues();
        v.put("title", title);
        v.put("body", body);
        v.put("created", now);
        v.put("updated", now);
        return getWritableDatabase().insert(TABLE, null, v);
    }

    void update(long id, String title, String body) {
        ContentValues v = new ContentValues();
        v.put("title", title);
        v.put("body", body);
        v.put("updated", System.currentTimeMillis());
        getWritableDatabase().update(TABLE, v, "_id = ?", new String[]{String.valueOf(id)});
    }

    void delete(long id) {
        getWritableDatabase().delete(TABLE, "_id = ?", new String[]{String.valueOf(id)});
    }

    private static Story read(Cursor c) {
        Story s = new Story();
        s.id = c.getLong(0);
        s.title = c.getString(1);
        s.body = c.getString(2);
        s.created = c.getLong(3);
        s.updated = c.getLong(4);
        return s;
    }
}
