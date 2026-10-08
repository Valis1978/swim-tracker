// `next` comes from a query string, never pass arbitrary URLs into router.replace.
export function safeLoginPath(path: string | null): string {
  if (path && /^\/(?:viki|zavody|dalkove|nastaveni|prehled(?:\/(?:duel|forma|srovnani))?|plavec\/[a-zA-Z0-9-]+)?$/.test(path)) return path;
  return "/viki";
}
