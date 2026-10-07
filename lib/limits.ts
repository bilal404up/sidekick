export const MAX_USER_MESSAGES_PER_SESSION_HOUR = 20;
export const MAX_USER_MESSAGES_PER_IP_HOUR = 60;

/** True when another message is allowed. */
export function withinLimits(sessionCount: number, ipCount: number): boolean {
  return sessionCount < MAX_USER_MESSAGES_PER_SESSION_HOUR && ipCount < MAX_USER_MESSAGES_PER_IP_HOUR;
}
