import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}

// Convenience proxy — throws at use time, not import time.
// type assertion は Proxy パターンの制約上必要: Stripe クラスのプロパティに
// 動的アクセスするため Record<string | symbol, unknown> へキャストしている。
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
