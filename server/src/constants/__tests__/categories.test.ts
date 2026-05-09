import { CATEGORY_LIST } from '../categories.js';

describe('Categories sorting alignment', () => {
  it('should have identical order when sorted by id vs name', () => {
    const sortedById = [...CATEGORY_LIST].sort((a, b) => a.id.localeCompare(b.id));
    const sortedByName = [...CATEGORY_LIST].sort((a, b) => a.name.localeCompare(b.name));

    expect(sortedById).toEqual(sortedByName);
  });
});
