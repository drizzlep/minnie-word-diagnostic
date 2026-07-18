export function storedStateStatus(savedState, currentVersion) {
  if (!savedState) return "missing";
  return savedState.version === currentVersion ? "current" : "legacy";
}
