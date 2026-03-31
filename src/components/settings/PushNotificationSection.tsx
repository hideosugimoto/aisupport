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
    <div className="rounded-lg border border-border-brand bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium text-text">
        プッシュ通知
      </h2>

      {!pushSupported ? (
        <p className="text-sm text-text2">
          このブラウザはプッシュ通知に対応していません
        </p>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text">
              ブラウザ通知
            </p>
            <p className="text-xs text-text2">
              リマインダーや予算アラートを受信
            </p>
          </div>
          <button
            type="button"
            onClick={pushSubscribed ? onUnsubscribe : onSubscribe}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              pushSubscribed
                ? "bg-amber-bg text-amber-brand hover:bg-amber-bg"
                : "bg-root-bg text-root-color hover:bg-forest"
            }`}
          >
            {pushSubscribed ? "無効にする" : "有効にする"}
          </button>
        </div>
      )}
    </div>
  );
}
