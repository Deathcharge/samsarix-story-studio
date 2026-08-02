const activeUsers = new Set<number>();

export function claimGeneration(userId: number) {
  if (activeUsers.has(userId)) return false;
  activeUsers.add(userId);
  return true;
}

export function releaseGeneration(userId: number) {
  activeUsers.delete(userId);
}
