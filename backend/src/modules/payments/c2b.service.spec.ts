import { C2bService } from './c2b.service';

describe('C2bService.isAccountNumber', () => {
  it('accepts any account numbering the billing system uses', () => {
    for (const ref of ['FBI0011', 'KNX-204', 'KTL12', '12345', 'A1', 'acc 77', 'BLK/12']) expect(C2bService.isAccountNumber(ref)).toBe(true);
  });

  it('does not treat phone numbers or plain words as account numbers', () => {
    for (const ref of ['0712345678', '254712345678', '0112 345 678', '712345678', 'RENT', 'internet', '', '   ', 'a'.repeat(45) + '1']) expect(C2bService.isAccountNumber(ref)).toBe(false);
  });
});
