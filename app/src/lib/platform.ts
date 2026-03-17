/**
 * macOS 下 Tauri 进程内的 HTTP 请求（reqwest/HTTP 插件）受系统网络策略限制，
 * 无法直连外部服务。需要通过 curl 外部进程绕过此限制。
 * Windows/Linux 不存在此问题，继续使用 Tauri HTTP 插件。
 */
export function isMacOS(): boolean {
  return navigator.userAgent?.toLowerCase().includes('macintosh') ?? false;
}
