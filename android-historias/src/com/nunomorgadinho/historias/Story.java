package com.nunomorgadinho.historias;

/** Uma história guardada. */
final class Story {
    long id = -1;
    String title = "";
    String body = "";
    long created;
    long updated;

    static int countWords(String text) {
        if (text == null) return 0;
        String t = text.trim();
        if (t.isEmpty()) return 0;
        return t.split("\\s+").length;
    }
}
