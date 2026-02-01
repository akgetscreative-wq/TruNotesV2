package com.trunotes.v2;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Paint;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import org.json.JSONObject;
import java.util.List;

public class TodoRemoteViewsService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new TodoRemoteViewsFactory(this.getApplicationContext());
    }
}

class TodoRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {
    private Context context;
    private List<JSONObject> todos;

    public TodoRemoteViewsFactory(Context context) {
        this.context = context;
    }

    @Override
    public void onCreate() {}

    @Override
    public void onDataSetChanged() {
        todos = WidgetUtils.getTodos(context);
        // Sort: incomplete at top, then newest at top
        todos.sort((a, b) -> {
            try {
                boolean aComp = a.getBoolean("completed");
                boolean bComp = b.getBoolean("completed");
                if (aComp != bComp) return aComp ? 1 : -1;
                
                long aTime = a.optLong("createdAt", 0);
                long bTime = b.optLong("createdAt", 0);
                return Long.compare(bTime, aTime);
            } catch (Exception e) {
                return 0;
            }
        });
    }

    @Override
    public void onDestroy() {}

    @Override
    public int getCount() {
        return todos != null ? todos.size() : 0;
    }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position < 0 || position >= getCount()) return null;

        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_todo_item);
        try {
            JSONObject todo = todos.get(position);
            String text = todo.getString("text");
            boolean completed = todo.getBoolean("completed");

            rv.setTextViewText(R.id.todo_text, text);
            
            if (completed) {
                rv.setImageViewResource(R.id.todo_checkbox, android.R.drawable.checkbox_on_background);
                rv.setTextColor(R.id.todo_text, Color.parseColor("#88FFFFFF"));
                // Strike-through (only works on some Android versions via RemoteViews, but we try)
                // Note: RemoteViews doesn't support setPaintFlags directly easily, so we just dim it.
            } else {
                rv.setImageViewResource(R.id.todo_checkbox, android.R.drawable.checkbox_off_background);
                rv.setTextColor(R.id.todo_text, Color.WHITE);
            }

            // Set dynamic behavior: Toggling completion
            // We'll broadcast a toggle intent when the item is clicked
            Intent fillInIntent = new Intent();
            fillInIntent.putExtra("todo_id", todo.getString("id"));
            fillInIntent.putExtra("target_val", !completed);
            rv.setOnClickFillInIntent(R.id.todo_checkbox, fillInIntent);
            rv.setOnClickFillInIntent(R.id.todo_text, fillInIntent); // clicking text also toggles

        } catch (Exception e) {
            e.printStackTrace();
        }

        return rv;
    }

    @Override
    public RemoteViews getLoadingView() { return null; }

    @Override
    public int getViewTypeCount() { return 1; }

    @Override
    public long getItemId(int position) { return position; }

    @Override
    public boolean hasStableIds() { return true; }
}
