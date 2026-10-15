/** 把点分十进制 IPv4 地址解析为 32 位整数；格式不合法时返回 undefined。 */
function parseIPv4(address: string): number | undefined {
  const parts = address.split('.');
  if (parts.length !== 4) return undefined;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return undefined;
    const octet = Number(part);
    if (octet > 255) return undefined;
    value = value * 256 + octet;
  }
  return value;
}

/** 把 IPv6 地址解析为八个 16 位分组；格式不合法时返回 undefined。 */
function parseIPv6(address: string): number[] | undefined {
  const zoneIndex = address.indexOf('%');
  let value = (zoneIndex === -1 ? address : address.slice(0, zoneIndex)).toLowerCase();
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);

  // 末尾的 IPv4 写法按两个 16 位分组参与展开。
  const lastColon = value.lastIndexOf(':');
  const tail = value.slice(lastColon + 1);
  const embedded = tail.includes('.') ? parseIPv4(tail) : undefined;
  if (embedded !== undefined) {
    value = `${value.slice(0, lastColon)}:${(embedded >>> 16).toString(16)}:${(embedded & 0xffff).toString(16)}`;
  }

  const halves = value.split('::');
  if (halves.length > 2) return undefined;
  const groups = (part: string) => (part ? part.split(':').map(group => parseInt(group, 16)) : []);
  const head = groups(halves[0] ?? '');
  const rest = halves.length === 2 ? groups(halves[1] ?? '') : [];
  if ([...head, ...rest].some(group => !Number.isInteger(group) || group < 0 || group > 0xffff)) {
    return undefined;
  }

  if (halves.length === 1) return head.length === 8 ? head : undefined;
  const missing = 8 - head.length - rest.length;
  if (missing < 1) return undefined;
  return [...head, ...Array<number>(missing).fill(0), ...rest];
}

/** 判断地址是否指向环回、私网、链路本地或其他不可路由的内网范围。 */
export function isPrivateAddress(address: string): boolean {
  const ipv4 = parseIPv4(address);
  if (ipv4 !== undefined) {
    return (
      ipv4 >>> 24 === 0 || // 0.0.0.0/8
      ipv4 >>> 24 === 10 || // 10.0.0.0/8
      ipv4 >>> 24 === 127 || // 127.0.0.0/8
      ipv4 >>> 16 === 0xa9fe || // 169.254.0.0/16，含云元数据地址 169.254.169.254
      ipv4 >>> 20 === 0xac1 || // 172.16.0.0/12
      ipv4 >>> 16 === 0xc0a8 || // 192.168.0.0/16
      ipv4 >>> 22 === 0x191 // 100.64.0.0/10，运营商级 NAT 内部地址
    );
  }

  const groups = parseIPv6(address);
  if (!groups) return false;

  const highGroupsZero = groups.slice(0, 5).every(group => group === 0);
  // IPv4 映射地址（::ffff:a.b.c.d）按其 IPv4 语义判断。
  if (highGroupsZero && groups[5] === 0xffff) {
    const octets = [groups[6]!, groups[7]!].flatMap(group => [group >>> 8, group & 0xff]);
    return isPrivateAddress(octets.join('.'));
  }

  return (
    (groups[0]! & 0xfe00) === 0xfc00 || // fc00::/7
    (groups[0]! & 0xffc0) === 0xfe80 || // fe80::/10
    (highGroupsZero && groups[5] === 0 && (groups[6]! & 0xff00) === 0x7f00) || // ::ffff:0:127.0.0.0/104
    (highGroupsZero && groups[5] === 0 && groups[6] === 0 && groups[7]! <= 1) // :: 与 ::1
  );
}

/** 判断主机名是否明显属于本机或内网命名空间。 */
export function isPrivateHostname(hostname: string): boolean {
  const value = hostname.toLowerCase().replace(/\.$/, '');
  return (
    value === 'localhost' ||
    value.endsWith('.localhost') ||
    value.endsWith('.local') ||
    value.endsWith('.internal')
  );
}
