/**
 * OpenConnect Test API — Mock Banking Service
 * 
 * A standalone mock server that simulates a real payment gateway API.
 * Used to demonstrate the full OpenConnect Configuration flow:
 *   Form → SQL → DB Insert → API Layer Invocation → Response Mapping
 * 
 * Endpoints:
 *   POST /api/v1/account/balance-inquiry      — Account Balance Inquiry
 *   POST /api/v1/account/fund-transfer        — Fund Transfer
 *   POST /api/v1/account/title-fetch          — Account Title Fetch (IBFT)
 *   POST /api/v1/payment/raast-transfer       — RAAST Instant Payment
 *   POST /api/v1/card/verify                  — Card Verification / 3DS
 *   GET  /api/v1/health                       — Health check
 * 
 * Start:  node server/test-api.js
 * Port:   3010
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3010;

app.use(cors());
app.use(express.json());

// ─── Request logging ─────────────────────────────
app.use((req, res, next) => {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`  [${ts}] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`           Body: ${JSON.stringify(req.body).substring(0, 120)}`);
  }
  next();
});

// ─── Health Check ────────────────────────────────
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'UP', service: 'OpenConnect Test Bank API', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── POST /api/v1/account/balance-inquiry ────────
app.post('/api/v1/account/balance-inquiry', (req, res) => {
  const { bankCode, accountNumber, iban, rrn, stan, channelId } = req.body;

  // Simulate different responses based on bankCode
  if (bankCode === '999') {
    return res.json({
      responseCode: '002',
      responseMessage: 'Bank not reachable',
      data: null
    });
  }

  if (!accountNumber && !iban) {
    return res.json({
      responseCode: '003',
      responseMessage: 'Invalid request — accountNumber or iban required',
      data: null
    });
  }

  // Simulate account not found
  if (accountNumber === '0000000000') {
    return res.json({
      responseCode: '001',
      responseMessage: 'Account not found',
      data: { rrn: rrn || '000000000000', stan: stan || '000000' }
    });
  }

  // ─── Happy path: success ───────────────────────
  const accountTitle = accountNumber === '1234567890'
    ? 'MUHAMMAD AHMED KHAN'
    : accountNumber === '9876543210'
      ? 'FATIMA ZAHRA SHEIKH'
      : 'AHMED ALI';

  const availableBalance = accountNumber === '1234567890' ? '150,250.75' : '85,430.00';

  res.json({
    responseCode: '000',
    responseMessage: 'Balance inquiry successful',
    data: {
      accountTitle,
      accountNumber: accountNumber || '',
      iban: iban || `PK36SCBL0000001${accountNumber?.substring(0, 10) || '123456'}`,
      bankCode: bankCode || '01',
      availableBalance,
      currentBalance: availableBalance,
      currency: 'PKR',
      branchCode: '0154',
      accountStatus: 'ACTIVE',
      rrn: rrn || String(Date.now()).substring(0, 12),
      stan: stan || String(Date.now()).substring(6, 12)
    }
  });
});

// ─── POST /api/v1/account/fund-transfer ──────────
app.post('/api/v1/account/fund-transfer', (req, res) => {
  const { fromAccount, toAccount, amount, currency, rrn, stan, bankCode } = req.body;

  if (!fromAccount || !toAccount || !amount) {
    return res.json({
      responseCode: '003',
      responseMessage: 'Missing required fields: fromAccount, toAccount, amount',
      data: null
    });
  }

  if (Number(amount) > 1000000) {
    return res.json({
      responseCode: '004',
      responseMessage: 'Amount exceeds daily transfer limit',
      data: { rrn, stan }
    });
  }

  if (fromAccount === toAccount) {
    return res.json({
      responseCode: '005',
      responseMessage: 'Source and destination accounts cannot be the same',
      data: { rrn, stan }
    });
  }

  // ─── Happy path: transfer success ──────────────
  res.json({
    responseCode: '000',
    responseMessage: 'Fund transfer completed successfully',
    data: {
      transactionId: `TXN${Date.now()}`,
      fromAccount,
      toAccount,
      amount,
      currency: currency || 'PKR',
      status: 'COMPLETED',
      bankCode: bankCode || '01',
      rrn: rrn || String(Date.now()).substring(0, 12),
      stan: stan || String(Date.now()).substring(6, 12),
      transactionDate: new Date().toISOString()
    }
  });
});

// ─── POST /api/v1/account/title-fetch ────────────
// Simulates an IBFT account title lookup before interbank transfer
app.post('/api/v1/account/title-fetch', (req, res) => {
  const { bankCode, accountNumber, iban, rrn, stan, channelId } = req.body;

  if (!accountNumber && !iban) {
    return res.json({
      responseCode: '003',
      responseMessage: 'Invalid request — accountNumber or iban required',
      data: null
    });
  }

  if (bankCode === '999') {
    return res.json({ responseCode: '091', responseMessage: 'Issuer unavailable', data: null });
  }

  if (accountNumber === '0000000000' || iban === 'PK00XXXX0000000000000000') {
    return res.json({ responseCode: '014', responseMessage: 'Invalid account number', data: null });
  }

  const titles = {
    '1234567890': 'MUHAMMAD AHMED KHAN',
    '9876543210': 'FATIMA ZAHRA SHEIKH',
    '1111111111': 'UNEEB AHMED',
    '2222222222': 'ALI HASSAN MIRZA',
  };

  const title = titles[accountNumber] || `ACCOUNT HOLDER - ${accountNumber?.slice(-4)}`;

  res.json({
    responseCode: '000',
    responseMessage: 'Title fetch successful',
    data: {
      accountTitle: title,
      accountNumber: accountNumber || '',
      iban: iban || `PK36SCBL0000001${accountNumber?.substring(0, 10) || '0001234567'}`,
      bankCode: bankCode || '01',
      bankName: 'Standard Chartered Bank Pakistan',
      accountStatus: 'ACTIVE',
      accountType: 'SAVINGS',
      rrn: rrn || String(Date.now()).substring(0, 12),
      stan: stan || String(Date.now()).substring(6, 12),
    }
  });
});

// ─── POST /api/v1/payment/raast-transfer ─────────
// Simulates a RAAST (Pakistan instant payment) transfer
app.post('/api/v1/payment/raast-transfer', (req, res) => {
  const { senderIban, receiverIban, receiverAlias, amount, currency, purposeCode, rrn, stan, channelId } = req.body;

  if (!senderIban || (!receiverIban && !receiverAlias)) {
    return res.json({
      responseCode: 'ER01',
      responseMessage: 'Missing required fields: senderIban and receiverIban/receiverAlias',
      data: null
    });
  }

  if (senderIban === receiverIban) {
    return res.json({
      responseCode: 'ER05',
      responseMessage: 'Sender and receiver cannot be the same',
      data: null
    });
  }

  if (Number(amount) > 2500000) {
    return res.json({
      responseCode: 'ER04',
      responseMessage: 'Transaction amount exceeds RAAST per-transaction limit',
      data: { rrn, stan, limit: '2500000', currency: currency || 'PKR' }
    });
  }

  if (receiverAlias === 'BLOCKED_USER' || receiverIban === 'PK00RAST0000000000000000') {
    return res.json({
      responseCode: 'ER09',
      responseMessage: 'Receiver account is blocked or restricted',
      data: null
    });
  }

  res.json({
    responseCode: '00',
    responseMessage: 'RAAST transfer completed successfully',
    data: {
      raastTransactionId: `RAAST${Date.now()}`,
      senderIban,
      receiverIban: receiverIban || `PK${receiverAlias}00000000000001`,
      receiverAlias: receiverAlias || '',
      receiverName: receiverAlias ? `${receiverAlias.replaceAll('_', ' ')}` : 'RECEIVER NAME',
      amount: String(amount),
      currency: currency || 'PKR',
      purposeCode: purposeCode || 'P2P',
      status: 'COMPLETED',
      rrn: rrn || String(Date.now()).substring(0, 12),
      stan: stan || String(Date.now()).substring(6, 12),
      settlementDate: new Date().toISOString().split('T')[0],
      processingTime_ms: Math.floor(Math.random() * 200 + 100),
    }
  });
});

// ─── POST /api/v1/card/verify ─────────────────────
// Simulates card verification / 3DS OTP check
app.post('/api/v1/card/verify', (req, res) => {
  const { cardNumber, expiryMonth, expiryYear, cvv, otp, amount, merchantId, rrn, stan } = req.body;

  if (!cardNumber || !expiryMonth || !expiryYear) {
    return res.json({
      responseCode: 'CV03',
      responseMessage: 'Card number, expiry month and year are required',
      data: null
    });
  }

  const last4 = String(cardNumber).slice(-4);

  // Simulate specific card scenarios
  if (last4 === '0000') {
    return res.json({ responseCode: 'CV14', responseMessage: 'Invalid card number', data: null });
  }
  if (last4 === '9999') {
    return res.json({ responseCode: 'CV54', responseMessage: 'Card expired', data: null });
  }
  if (cvv === '000') {
    return res.json({ responseCode: 'CV82', responseMessage: 'Invalid CVV', data: null });
  }
  if (otp && otp !== '123456') {
    return res.json({ responseCode: 'CV68', responseMessage: '3DS OTP verification failed', data: null });
  }

  const schemes = {
    '4': 'VISA',
    '5': 'MASTERCARD',
    '3': 'AMEX',
    '6': 'UNIONPAY',
  };
  const scheme = schemes[String(cardNumber)[0]] || 'VISA';

  res.json({
    responseCode: 'CV00',
    responseMessage: 'Card verified successfully',
    data: {
      verificationToken: `CVT${Date.now()}${last4}`,
      cardLast4: last4,
      cardScheme: scheme,
      cardHolderName: last4 === '1234' ? 'UNEEB AHMED' : `CARDHOLDER ${last4}`,
      expiryMonth,
      expiryYear,
      threeDSAuthenticated: !!otp,
      acsTransactionId: otp ? `ACS${Date.now()}` : null,
      merchantId: merchantId || 'MCH001',
      amount: amount || null,
      rrn: rrn || String(Date.now()).substring(0, 12),
      stan: stan || String(Date.now()).substring(6, 12),
    }
  });
});

// ─── POST /api/v1/payment/bill-payment ─────────────
// Simulates a utility bill payment (LESCO, SSGC, PTCL, etc.)
app.post('/api/v1/payment/bill-payment', (req, res) => {
  const { channelId, requestId, traceId, transactionDateTime, bankCode,
          billerCode, consumerNumber, amount, currency, rrn, stan } = req.body;

  // Validation
  if (!billerCode || !consumerNumber || !amount) {
    return res.json({
      responseCode: 'BP03',
      responseMessage: 'Missing required fields: billerCode, consumerNumber, amount',
      data: null
    });
  }

  // Unknown biller
  const knownBillers = ['LESCO', 'SSGC', 'SNGPL', 'PTCL', 'KESC', 'WAPDA'];
  if (!knownBillers.includes(billerCode.toUpperCase())) {
    return res.json({
      responseCode: 'BP06',
      responseMessage: `Biller not found: ${billerCode}`,
      data: null
    });
  }

  // Consumer not found
  if (consumerNumber === '0000000000') {
    return res.json({
      responseCode: 'BP14',
      responseMessage: 'Consumer number not registered with biller',
      data: null
    });
  }

  // Amount mismatch — simulate exact-amount billers
  if (billerCode.toUpperCase() === 'PTCL' && Number(amount) < 500) {
    return res.json({
      responseCode: 'BP61',
      responseMessage: 'Payment amount is less than the outstanding bill amount',
      data: { outstandingAmount: '500', currency: 'PKR', rrn, stan }
    });
  }

  // Bank unreachable
  if (bankCode === '999') {
    return res.json({
      responseCode: 'BP91',
      responseMessage: 'Biller host unavailable. Try again later.',
      data: null
    });
  }

  // ─── Happy path ──────────────────────────────────
  const billerNames = {
    LESCO: 'Lahore Electric Supply Company',
    SSGC: 'Sui Southern Gas Company',
    SNGPL: 'Sui Northern Gas Pipelines Ltd',
    PTCL: 'Pakistan Telecommunication Company',
    KESC: 'Karachi Electric Supply Company',
    WAPDA: 'Water and Power Development Authority',
  };

  res.json({
    responseCode: '000',
    responseMessage: 'Bill payment successful',
    data: {
      paymentReference: `BP${Date.now()}`,
      billerCode: billerCode.toUpperCase(),
      billerName: billerNames[billerCode.toUpperCase()] || billerCode,
      consumerNumber,
      consumerName: consumerNumber === '1234567890' ? 'UNEEB AHMED' : `CONSUMER-${consumerNumber.slice(-4)}`,
      paidAmount: String(amount),
      currency: currency || 'PKR',
      bankCode: bankCode || '01',
      paymentDateTime: new Date().toISOString(),
      receiptNumber: `RCP${String(Date.now()).slice(-8)}`,
      rrn: rrn || String(Date.now()).substring(0, 12),
      stan: stan || String(Date.now()).substring(6, 12),
      status: 'PAID'
    }
  });
});

// ─── 404 fallback ────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ responseCode: '404', responseMessage: `Endpoint not found: ${req.method} ${req.url}` });
});
// ─── Start ───────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   OpenConnect Test Bank API v2.0             ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║   URL:  http://localhost:${PORT}               ║`);
  console.log('  ║   Mode: Mock Banking Service (6 endpoints)   ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log('  ║   1. POST /api/v1/account/balance-inquiry    ║');
  console.log('  ║   2. POST /api/v1/account/fund-transfer      ║');
  console.log('  ║   3. POST /api/v1/account/title-fetch        ║');
  console.log('  ║   4. POST /api/v1/payment/raast-transfer     ║');
  console.log('  ║   5. POST /api/v1/card/verify                ║');
  console.log('  ║   6. POST /api/v1/payment/bill-payment       ║');
  console.log('  ║   7. GET  /api/v1/health                     ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});
