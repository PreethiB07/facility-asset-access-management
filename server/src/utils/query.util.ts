import { Role } from '@prisma/client';

export interface ActiveFilter {
  isActive?: boolean;
}

export function resolveActiveFilter(role: Role, active?: string): ActiveFilter {
  if (active === 'true') {
    return { isActive: true };
  }

  if (active === 'false') {
    return { isActive: false };
  }

  if (role === Role.ADMIN) {
    return {};
  }

  return { isActive: true };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function getRouteParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}
