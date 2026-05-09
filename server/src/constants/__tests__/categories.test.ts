import { CATEGORIES } from '../categories.js';

describe('Categories sorting alignment', () => {
  it('should have identical order when sorted by id vs name', () => {
    const entries = Object.entries(CATEGORIES);
    const sortedById = [...entries].sort((a, b) => a[0].localeCompare(b[0]));
    const sortedByName = [...entries].sort((a, b) => a[1].name.localeCompare(b[1].name));

    expect(sortedById).toEqual(sortedByName);
  });
});
