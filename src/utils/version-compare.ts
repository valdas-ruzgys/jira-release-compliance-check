import semver from 'semver';

function compareVersions(version1: string, version2: string): number {
  const v1 = semver.coerce(version1);
  const v2 = semver.coerce(version2);

  if (!v1 || !v2) {
    // Fallback to string comparison if semver coerce fails
    return version1.localeCompare(version2);
  }

  return semver.compare(v1, v2);
}

/**
 * Checks if version1 is higher than version2
 */
export function isVersionHigher(version1: string, version2: string): boolean {
  return compareVersions(version1, version2) > 0;
}
