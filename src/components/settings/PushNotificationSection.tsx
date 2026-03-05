"use client";

interface PushNotificationSectionProps {
  pushSupported: boolean;
  pushSubscribed: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
}

export function PushNotificationSection({
  pushSupported,
  pushSubscribed,
  onSubscribe,
  onUnsubscribe,
}: PushNotificationSectionProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        プッシュ通知
      </h2>

      {!pushSupported ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          このブラウザはプッシュ通知に対応していません
        </p>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              ブラウザ通知
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              リマインダーや予算アラートを受信
            </p>
          </div>
          <button
            type="button"
            onClick={pushSubscribed ? onUnsubscribe : onSubscribe}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              pushSubscribed
                ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300"
                : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            }`}
          >
            {pushSubscribed ? "無効にする" : "有効にする"}
          </button>
        </div>
      )}
    </div>
  );
}
