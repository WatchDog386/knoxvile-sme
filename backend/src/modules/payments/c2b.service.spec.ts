import { C2bService } from './c2b.service';

describe('C2bService.isAccountNumber', () => {
  it('accepts any account numbering the billing system uses', () => {
    for (const ref of ['FBI0011', 'KNX-204', 'KTL12', '12345', 'A1', 'acc 77', 'BLK/12']) expect(C2bService.isAccountNumber(ref)).toBe(true);
  });

  it('does not treat phone numbers or plain words as account numbers', () => {
    for (const ref of ['0712345678', '254712345678', '0112 345 678', '712345678', 'RENT', 'internet', '', '   ', 'a'.repeat(45) + '1']) expect(C2bService.isAccountNumber(ref)).toBe(false);
  });
});

describe('C2bService.normalisePayload', () => {
  it("reads the billing system's own field names", () => {
    const p = C2bService.normalisePayload({
      id: 26429,
      transaction_id: 'UJR5Z0IWP1',
      transaction_time: '20261027191235',
      amount: '2500.00',
      phone: 'd78ea7456ed17012a13551de12e5073a18dcb047',
      firstname: 'PAULINE',
      middlename: '',
      lastname: '',
      account: '20210768',
    });
    expect(p).toEqual({ TransID: 'UJR5Z0IWP1', TransTime: '20261027191235', TransAmount: '2500.00', MSISDN: 'd78ea7456ed17012a13551de12e5073a18dcb047', FirstName: 'PAULINE', BillRefNumber: '20210768' });
  });

  it("keeps Safaricom's names and unwraps { data: ... }", () => {
    expect(C2bService.normalisePayload({ TransID: 'ABC', TransAmount: 5, BillRefNumber: 'FBI001' })).toMatchObject({ TransID: 'ABC', TransAmount: '5', BillRefNumber: 'FBI001' });
    expect(C2bService.normalisePayload({ data: { transaction_id: 'X1', amount: 10 } })).toMatchObject({ TransID: 'X1', TransAmount: '10' });
    expect(C2bService.normalisePayload(null)).toEqual({});
  });

  it('ignores a masked phone number', () => {
    expect(C2bService.localPhone('d78ea7456ed17012a13551de12e5073a18dcb047')).toBeNull();
    expect(C2bService.localPhone('254712345678')).toBe('0712345678');
  });
});

describe('C2bService.hotspotRef', () => {
  it('recognises hotspot purchases (router and device)', () => {
    expect(C2bService.hotspotRef('ROUTER1,82:F8:E8:0B:BB:F2')).toEqual({ router: 'ROUTER1', mac: '82:F8:E8:0B:BB:F2' });
    expect(C2bService.hotspotRef('ROUTER2,32:5E:58:74:E6:64')).toEqual({ router: 'ROUTER2', mac: '32:5E:58:74:E6:64' });
  });
  it('leaves subscriber account numbers alone', () => {
    for (const ref of ['20210768', 'FBI0011', 'KNX-204', '']) expect(C2bService.hotspotRef(ref)).toBeNull();
    expect(C2bService.isAccountNumber('ROUTER1,82:F8:E8:0B:BB:F2')).toBe(false);
  });
});
