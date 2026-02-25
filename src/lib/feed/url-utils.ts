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
