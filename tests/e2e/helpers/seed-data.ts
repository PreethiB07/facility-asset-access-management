/** Seed data names from server/prisma/seed.ts — Company A (Acme). */
export const ACME = {
  mainOperationsFacility: 'Acme Main Operations Facility',
  productionFacility: 'Acme Production Facility',
  inactiveFacility: 'Acme Decommissioned Warehouse',
  serverRoom: 'Server Room',
  equipmentRoom: 'Equipment Room',
  productionFloor: 'Production Floor',
  generator: 'Generator',
  forklift: 'Forklift',
  independentAsset: 'Independent Asset',
} as const;

/** Seed data names — Company B (Globex). */
export const GLOBEX = {
  mainOperationsFacility: 'Globex Main Operations Facility',
  productionFacility: 'Globex Production Facility',
  inactiveFacility: 'Globex Decommissioned Warehouse',
  serverRoom: 'Server Room',
  generator: 'Generator',
  independentAsset: 'Independent Asset',
} as const;
