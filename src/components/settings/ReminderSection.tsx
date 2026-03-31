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
      <div className="rounded-lg border border-border-brand bg-surface p-6">
        <h2 className="mb-4 text-sm font-medium text-text">
          リマインダー
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="reminder-enabled" className="text-sm text-text">
              毎日のリマインダー
            </label>
            <input
              id="reminder-enabled"
              type="checkbox"
              checked={settings.reminderEnabled}
              onChange={(e) =>
                onSettingsChange((s) => ({ ...s, reminderEnabled: e.target.checked }))
              }
              className="rounded border-border-brand"
            />
          </div>

          {settings.reminderEnabled && (
            <div>
              <label htmlFor="reminder-time" className="mb-1 block text-xs text-text2">
                通知時刻
              </label>
              <input
                id="reminder-time"
                type="time"
                value={settings.reminderTime}
                onChange={(e) =>
                  onSettingsChange((s) => ({ ...s, reminderTime: e.target.value }))
                }
                className="rounded-lg border border-border-brand px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="budget-alert" className="text-sm text-text">
                予算アラート
              </label>
              <p className="text-xs text-text2">
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
              className="rounded border-border-brand"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="digest-enabled" className="text-sm text-text">
                メールダイジェスト
              </label>
              <p className="text-xs text-text2">
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
              className="rounded border-border-brand"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        aria-busy={saving}
        className="w-full rounded-lg bg-root-bg px-4 py-3 text-sm font-medium text-root-color transition-colors hover:bg-forest disabled:opacity-50"
      >
        {saving ? "保存中..." : "通知設定を保存"}
      </button>
    </>
  );
}
