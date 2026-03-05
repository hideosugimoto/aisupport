"use client";

interface NotificationSettings {
  reminderEnabled: boolean;
  reminderTime: string;
  budgetAlert: boolean;
  digestEnabled: boolean;
}

interface ReminderSectionProps {
  settings: NotificationSettings;
  saving: boolean;
  onSettingsChange: (updater: (prev: NotificationSettings) => NotificationSettings) => void;
  onSave: () => void;
}

export function ReminderSection({
  settings,
  saving,
  onSettingsChange,
  onSave,
}: ReminderSectionProps) {
  return (
    <>
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          リマインダー
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="reminder-enabled" className="text-sm text-zinc-700 dark:text-zinc-300">
              毎日のリマインダー
            </label>
            <input
              id="reminder-enabled"
              type="checkbox"
              checked={settings.reminderEnabled}
              onChange={(e) =>
                onSettingsChange((s) => ({ ...s, reminderEnabled: e.target.checked }))
              }
              className="rounded border-zinc-300 dark:border-zinc-600"
            />
          </div>

          {settings.reminderEnabled && (
            <div>
              <label htmlFor="reminder-time" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                通知時刻
              </label>
              <input
                id="reminder-time"
                type="time"
                value={settings.reminderTime}
                onChange={(e) =>
                  onSettingsChange((s) => ({ ...s, reminderTime: e.target.value }))
                }
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="budget-alert" className="text-sm text-zinc-700 dark:text-zinc-300">
                予算アラート
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                月間予算の80%を超えたら通知
              </p>
            </div>
            <input
              id="budget-alert"
              type="checkbox"
              checked={settings.budgetAlert}
              onChange={(e) =>
                onSettingsChange((s) => ({ ...s, budgetAlert: e.target.checked }))
              }
              className="rounded border-zinc-300 dark:border-zinc-600"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="digest-enabled" className="text-sm text-zinc-700 dark:text-zinc-300">
                メールダイジェスト
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                毎朝9時にフィード記事の要約をメールで配信（Pro限定）
              </p>
            </div>
            <input
              id="digest-enabled"
              type="checkbox"
              checked={settings.digestEnabled}
              onChange={(e) =>
                onSettingsChange((s) => ({ ...s, digestEnabled: e.target.checked }))
              }
              className="rounded border-zinc-300 dark:border-zinc-600"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        aria-busy={saving}
        className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {saving ? "保存中..." : "通知設定を保存"}
      </button>
    </>
  );
}
