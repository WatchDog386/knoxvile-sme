# Knoxville – M-Pesa paybill webhook

Please forward every confirmed payment to **our Paybill** to this webhook.

## Endpoint

```
POST https://sme.knoxvilletechnologies.com/api/v1/payments/mpesa/c2b
Content-Type: application/json
X-Webhook-Secret: <secret shared separately>
```

If your system cannot set headers, send the secret as a query parameter instead:
`https://sme.knoxvilletechnologies.com/api/v1/payments/mpesa/c2b?secret=<secret>`

## Body

The same fields Safaricom posts to a C2B **confirmation** URL. You can forward
Safaricom's body unchanged.

| Field | Required | Example | Notes |
| --- | --- | --- | --- |
| `TransID` | yes | `RKTQDM7W6S` | M-Pesa confirmation code; must be unique |
| `TransAmount` | yes | `"1499.00"` | Amount in KES |
| `BillRefNumber` | yes | `FBI0001` | Account number the client typed |
| `TransTime` | yes | `"20261017143005"` | `YYYYMMDDHHmmss`, Nairobi time |
| `MSISDN` | yes | `"254712345678"` | Payer's phone (masked is fine) |
| `FirstName` | yes | `"Jane"` | |
| `MiddleName` | no | `""` | |
| `LastName` | no | `"Wanjiku"` | |
| `TransactionType` | no | `"Pay Bill"` | |
| `BusinessShortCode` | no | `"123456"` | |
| `InvoiceNumber`, `OrgAccountBalance`, `ThirdPartyTransID` | no | `""` | |

Example:

```json
{
  "TransactionType": "Pay Bill",
  "TransID": "RKTQDM7W6S",
  "TransTime": "20261017143005",
  "TransAmount": "1499.00",
  "BusinessShortCode": "123456",
  "BillRefNumber": "FBI0001",
  "InvoiceNumber": "",
  "OrgAccountBalance": "",
  "ThirdPartyTransID": "",
  "MSISDN": "254712345678",
  "FirstName": "Jane",
  "MiddleName": "",
  "LastName": "Wanjiku"
}
```

## Response

- `200` `{"ResultCode":0,"ResultDesc":"Accepted"}` – received (also returned for a
  `TransID` that was already received, so resending is safe).
- `200` `{"ResultCode":1,"ResultDesc":"Rejected: …"}` – missing `TransID` or amount.
- `401` – wrong or missing secret.
- `5xx` – temporary problem on our side: please retry later.

Retries are safe: each `TransID` is applied only once.
