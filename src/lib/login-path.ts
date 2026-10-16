// `next` comes from a query string, never pass arbitrary URLs into router.replace.
export function safeLoginPath(path: string | null): string {
  if (path && /^\/(?:viki|zavody|zavod\/\d{1,9}|rekordy|dalkove|nastaveni|prehled(?:\/(?:duel|forma|srovnani))?|plavec\/[a-zA-Z0-9-]+)?$/.test(path)) return path;
  return "/viki";
}
