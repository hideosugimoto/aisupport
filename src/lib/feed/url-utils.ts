/**
 * フィード記事URLを正規化して重複排除に使えるカノニカル形式にする。
 * - http → https に統一
 * - トラッキングパラメータ (utm_*, fbclid, gclid 等) を除去
 * - フラグメント (#section) を除去
 * - 末尾スラッシュを除去（ルート "/" は維持）
 */
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
]);

export function normalizeArticleUrl(urlStr: string): string {
  try {
    // URL APIの仕様に従い、ローカルの url オブジェクトを直接変更する。
    // 元の urlStr は変更されない。
    const url = new URL(urlStr);

    // http → https
    if (url.protocol === "http:") {
      url.protocol = "https:";
    }

    // トラッキングパラメータを除去
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key) || key.startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    }

    // フラグメント除去
    url.hash = "";

    // 末尾スラッシュ除去（ルートパスは維持）
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    // パース失敗時はそのまま返す
    return urlStr;
  }
}

/**
 * URLがパブリック（プライベートIP/localhost以外）かどうかを検証する。
 * SSRF対策として外部URLへのfetch前にチェックする。
 */
export function isPublicUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (!url.protocol.startsWith("http")) return false;
    return !isPrivateHostname(url.hostname);
  } catch {
    return false;
  }
}

function isPrivateHostname(hostname: string): boolean {
  // localhost
  if (hostname === "localhost") return true;

  // IPv6 (括弧を除去)
  const bare = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
  if (bare.includes(":")) {
    return isPrivateIPv6(bare);
  }

  // IPv4
  return isPrivateIPv4(bare);
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;

  const a = parseInt(parts[0], 10);
  const b = parseInt(parts[1], 10);

  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 127.0.0.0/8 (loopback全体)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 (CGNAT, RFC 6598)
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  // ::1 (loopback)
  if (lower === "::1") return true;
  // :: (unspecified)
  if (lower === "::") return true;
  // fe80::/10 (link-local)
  if (lower.startsWith("fe80")) return true;
  // fc00::/7 (ULA)
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // ::ffff:x.x.x.x (IPv4-mapped IPv6)
  if (lower.startsWith("::ffff:")) {
    const ipv4Part = lower.slice(7);
    if (ipv4Part.includes(".")) {
      return isPrivateIPv4(ipv4Part);
    }
  }

  return false;
}
