import { describe, expect, it } from 'vitest';
import { formatTargetPath } from '../utils/targetPath';

describe('formatTargetPath', () => {
  it('shows facility name for facility targets', () => {
    expect(
      formatTargetPath({
        type: 'FACILITY',
        id: 'f1',
        name: 'Main Operations Facility',
      }),
    ).toBe('Main Operations Facility');
  });

  it('shows facility to area hierarchy for area targets', () => {
    expect(
      formatTargetPath({
        type: 'AREA',
        id: 'a1',
        name: 'Server Room',
        facilityName: 'Main Operations Facility',
      }),
    ).toBe('Main Operations Facility → Server Room');
  });

  it('shows facility to area to asset hierarchy for area assets', () => {
    expect(
      formatTargetPath({
        type: 'ASSET',
        id: 'as1',
        name: 'Security Camera',
        facilityName: 'Main Operations Facility',
        areaName: 'Server Room',
      }),
    ).toBe('Main Operations Facility → Server Room → Security Camera');
  });

  it('shows facility to asset hierarchy for independent assets', () => {
    expect(
      formatTargetPath({
        type: 'ASSET',
        id: 'as2',
        name: 'Independent Asset',
        facilityName: 'Main Operations Facility',
        areaName: null,
      }),
    ).toBe('Main Operations Facility → Independent Asset');
  });
});
