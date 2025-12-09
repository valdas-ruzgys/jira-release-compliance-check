import { isVersionHigher } from '../version-compare';

describe('version-compare', () => {
  describe('isVersionHigher', () => {
    it('should return true when first version is higher', () => {
      expect(isVersionHigher('2.0.0', '1.0.0')).toBe(true);
      expect(isVersionHigher('1.1.0', '1.0.0')).toBe(true);
      expect(isVersionHigher('6.16', '6.15')).toBe(true);
    });

    it('should return false when first version is lower or equal', () => {
      expect(isVersionHigher('1.0.0', '2.0.0')).toBe(false);
      expect(isVersionHigher('1.0.0', '1.0.0')).toBe(false);
      expect(isVersionHigher('6.14', '6.15')).toBe(false);
    });
  });
});
