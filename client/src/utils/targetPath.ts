import type { AccessTargetInfo } from '../types';

export function formatTargetPath(target: AccessTargetInfo): string {
  if (target.type === 'FACILITY') {
    return target.name;
  }

  if (target.type === 'AREA') {
    const facility = target.facilityName ?? 'Facility';
    return `${facility} → ${target.name}`;
  }

  const parts: string[] = [];
  if (target.facilityName) {
    parts.push(target.facilityName);
  }
  if (target.areaName) {
    parts.push(target.areaName);
  }
  parts.push(target.name);
  return parts.join(' → ');
}
