import { parseCSV } from '../csvParser.js';

describe('csvParser', () => {
  it('should parse a standard single-column amount CSV', () => {
    const csv = `Date,Description,Amount,Category
2025-04-23,Grocery Store,25.50,Dining
2025-04-24,Salary,-3000.00,Income`;

    const result = parseCSV(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: '2025-04-23',
      description: 'Grocery Store',
      amount: 25.5,
      rawCategory: 'Dining',
      categoryId: 'food',
      rawAccount: undefined,
      rawPerson: undefined,
    });
    expect(result[1].amount).toBe(-3000.0);
    expect(result[1].categoryId).toBeUndefined();
  });

  it('should handle different column names case-insensitively', () => {
    const csv = `transaction date,TRANSACTION DESCRIPTION,AMOUNT ($)
05/12/2025,Starbucks,5.25`;

    const result = parseCSV(csv);
    expect(result[0].date).toBe('2025-05-12');
    expect(result[0].description).toBe('Starbucks');
    expect(result[0].amount).toBe(5.25);
  });

  it('should parse two-column amount format (Debit/Credit)', () => {
    const csv = `Date,Description,Debit,Credit
2025-01-01,Rent,1500.00,
2025-01-02,Refund,,50.00`;

    const result = parseCSV(csv);

    expect(result[0].amount).toBe(1500.0);
    expect(result[1].amount).toBe(-50.0);
  });

  it('should handle currency symbols and commas in amounts', () => {
    const csv = `Date,Description,Amount
2025-01-01,Car,"$1,200.50"
2025-01-02,Return,"($50.00)"`;

    const result = parseCSV(csv);
    expect(result[0].amount).toBe(1200.5);
    expect(result[1].amount).toBe(-50.0);
  });

  it('should detect Account and Person via heuristics', () => {
    const csv = `Date,Description,Amount,Card No.,Card Member
2025-01-01,Amazon,45.00,1234,John Doe`;

    const result = parseCSV(csv);
    expect(result[0].rawAccount).toBe('1234');
    expect(result[0].rawPerson).toBe('John Doe');
  });

  it('should throw error for invalid CSV format', () => {
    const csv = `Wrong,Columns,Only
Value1,Value2,Value3`;

    expect(() => parseCSV(csv)).toThrow('CSV format not recognized');
  });

  it('should handle various date formats', () => {
    const csv = `Date,Description,Amount
2025-04-23,Test1,10.00
2025/04/23,Test2,20.00
04-23-2025,Test3,30.00
04/23/2025,Test4,40.00`;

    const result = parseCSV(csv);
    expect(result[0].date).toBe('2025-04-23');
    expect(result[1].date).toBe('2025-04-23');
    expect(result[2].date).toBe('2025-04-23');
    expect(result[3].date).toBe('2025-04-23');
  });

  it('should auto-assign categoryId based on RawCategory mapping', () => {
    const csv = `Date,Description,Amount,Category
2025-01-01,Delta Airlines,500.00,Airfare
2025-01-02,Whole Foods,80.00,Grocery
2025-01-03,Unknown Store,10.00,Something Else`;

    const result = parseCSV(csv);
    expect(result[0].rawCategory).toBe('Airfare');
    expect(result[0].categoryId).toBe('travel');
    expect(result[1].rawCategory).toBe('Grocery');
    expect(result[1].categoryId).toBe('groceries');
    expect(result[2].rawCategory).toBe('Something Else');
    expect(result[2].categoryId).toBeUndefined();
  });
});
