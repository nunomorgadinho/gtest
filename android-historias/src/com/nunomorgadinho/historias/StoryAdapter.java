package com.nunomorgadinho.historias;

import android.content.Context;
import android.text.format.DateUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

final class StoryAdapter extends BaseAdapter {
    private final Context context;
    private final LayoutInflater inflater;
    private List<Story> items = new ArrayList<Story>();

    StoryAdapter(Context context) {
        this.context = context;
        this.inflater = LayoutInflater.from(context);
    }

    void setItems(List<Story> stories) {
        items = stories;
        notifyDataSetChanged();
    }

    @Override public int getCount() { return items.size(); }
    @Override public Story getItem(int position) { return items.get(position); }
    @Override public long getItemId(int position) { return items.get(position).id; }
    @Override public boolean hasStableIds() { return true; }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        View v = convertView != null ? convertView
                : inflater.inflate(R.layout.item_story, parent, false);
        Story s = getItem(position);

        TextView title = (TextView) v.findViewById(R.id.title);
        TextView preview = (TextView) v.findViewById(R.id.preview);
        TextView meta = (TextView) v.findViewById(R.id.meta);

        String t = s.title.trim();
        title.setText(t.isEmpty() ? context.getString(R.string.untitled) : t);

        String body = s.body.trim().replaceAll("\\s+", " ");
        preview.setText(body);
        preview.setVisibility(body.isEmpty() ? View.GONE : View.VISIBLE);

        int words = Story.countWords(s.body);
        CharSequence when = DateUtils.getRelativeTimeSpanString(s.updated,
                System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS);
        meta.setText(when + "  ·  " + words + (words == 1 ? " palavra" : " palavras"));
        return v;
    }
}
