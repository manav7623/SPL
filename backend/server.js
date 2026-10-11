require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const xlsx = require('xlsx');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Configure Express Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'spl_2026_super_secret_session_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: false // Set to true if running over HTTPS
  }
}));

// Determine payment mode (Mock or Production)
const isRazorpayConfigured = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
const useMockPayment = process.env.USE_MOCK_PAYMENT === 'true' || !isRazorpayConfigured;

let razorpay = null;
if (!useMockPayment) {
  try {
    const Razorpay = require('razorpay');
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    console.log('Razorpay payment gateway initialized in Production mode.');
  } catch (err) {
    console.error('Error initializing Razorpay, falling back to Mock Mode:', err.message);
  }
} else {
  console.log('Razorpay is running in DEVELOPER MOCK MODE. Real money will not be charged.');
}

// Authentication Middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized admin access.' });
  }
}

// ==========================================
// PLAYER REGISTRATION API ENDPOINTS
// ==========================================

/**
 * Endpoint to create a new registration and order
 */
app.post('/api/register/order', async (req, res) => {
  try {
    const { name, mobile, playing_role, tshirt_size, tshirt_number, tshirt_name } = req.body;

    // Server-side validation
    if (!name || !mobile || !playing_role || !tshirt_size || !tshirt_number || !tshirt_name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Restrict mobile and T-shirt number to digits only
    if (!/^[0-9]+$/.test(mobile)) {
      return res.status(400).json({ error: 'Mobile number must contain only digits' });
    }
    if (mobile.length !== 10) {
      return res.status(400).json({ error: 'Mobile number must be exactly 10 digits' });
    }
    if (!/^[0-9]+$/.test(tshirt_number)) {
      return res.status(400).json({ error: 'T-shirt number must contain only digits' });
    }
    const jerseyNo = parseInt(tshirt_number, 10);
    if (jerseyNo < 0 || jerseyNo > 999) {
      return res.status(400).json({ error: 'T-shirt number must be between 0 and 999' });
    }

    const registrationFee = 500.0; // ₹500
    const registrationFeePaise = registrationFee * 100; // ₹500 in paise

    if (useMockPayment || !razorpay) {
      // Mock payment order creation
      const mockOrderId = `order_mock_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      
      // Save pending registration in database
      await db.createRegistration({
        name,
        mobile,
        playing_role,
        tshirt_size,
        tshirt_number,
        tshirt_name,
        amount: registrationFee,
        razorpay_order_id: mockOrderId
      });

      return res.json({
        success: true,
        isMock: true,
        orderId: mockOrderId,
        amount: registrationFeePaise,
        keyId: 'mock_key_id'
      });
    } else {
      // Create real Razorpay order
      const options = {
        amount: registrationFeePaise,
        currency: 'INR',
        receipt: `receipt_spl_${Date.now()}`
      };

      const order = await razorpay.orders.create(options);

      // Save pending registration in database
      await db.createRegistration({
        name,
        mobile,
        playing_role,
        tshirt_size,
        tshirt_number,
        tshirt_name,
        amount: registrationFee,
        razorpay_order_id: order.id
      });

      return res.json({
        success: true,
        isMock: false,
        orderId: order.id,
        amount: order.amount,
        keyId: process.env.RAZORPAY_KEY_ID
      });
    }
  } catch (error) {
    console.error('Error creating registration order:', error);
    res.status(500).json({ error: 'Failed to initiate registration. Please try again.' });
  }
});

/**
 * Endpoint to verify Razorpay signature and finalize registration
 */
app.post('/api/register/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({ error: 'Missing payment signature details.' });
    }

    const isMockOrder = razorpay_order_id.startsWith('order_mock_');

    if (isMockOrder) {
      // Verify mock order - always confirm
      const mockSignature = razorpay_signature || `sig_mock_${crypto.randomBytes(8).toString('hex')}`;
      const registration = await db.confirmPayment(razorpay_order_id, razorpay_payment_id, mockSignature);
      return res.json({
        success: true,
        registrationId: registration.registration_id,
        message: 'Registration successful! Payment verified.'
      });
    } else {
      // Verify real Razorpay signature
      if (!razorpay_signature) {
        return res.status(400).json({ error: 'Missing Razorpay signature' });
      }

      const text = razorpay_order_id + '|' + razorpay_payment_id;
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest('hex');

      if (generated_signature === razorpay_signature) {
        const registration = await db.confirmPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        return res.json({
          success: true,
          registrationId: registration.registration_id,
          message: 'Registration successful! Payment verified.'
        });
      } else {
        await db.failPayment(razorpay_order_id, 'Signature mismatch');
        return res.status(400).json({ error: 'Payment signature verification failed.' });
      }
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Payment verification failed. Contact organizers if money was debited.' });
  }
});

// ==========================================
// ADMIN DASHBOARD API ENDPOINTS
// ==========================================

/**
 * Login admin and set session
 */
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD || 'admin_spl_2026';

  if (username === expectedUser && password === expectedPass) {
    req.session.isAdmin = true;
    return res.json({ success: true, message: 'Logged in successfully.' });
  } else {
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }
});

/**
 * Logout admin
 */
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Could not log out.' });
    }
    return res.json({ success: true });
  });
});

/**
 * Check admin authorization status
 */
app.get('/api/admin/check-session', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({ authenticated: true });
  }
  return res.json({ authenticated: false });
});

/**
 * Get dashboard card metrics (Total, Paid, Pending, Collection)
 */
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await db.getAdminStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics.' });
  }
});

/**
 * Get paginated, searched, and filtered players
 */
app.get('/api/admin/players', requireAdmin, async (req, res) => {
  try {
    const search = req.query.search || '';
    const status = req.query.status || '';
    const role = req.query.role || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { players, totalCount } = await db.getRegistrations({ search, status, role, limit, offset });
    res.json({
      success: true,
      players,
      totalCount,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching players list:', error);
    res.status(500).json({ error: 'Failed to fetch player registrations.' });
  }
});

/**
 * Export all registrations to an Excel spreadsheet
 */
app.get('/api/admin/export', requireAdmin, async (req, res) => {
  try {
    const registrations = await db.getAllRegistrationsForExport();

    if (registrations.length === 0) {
      // Create a template with headings if empty
      registrations.push({
        registration_id: 'N/A',
        name: 'John Doe (Template)',
        mobile: '9999999999',
        playing_role: 'All-rounder',
        tshirt_size: 'L',
        tshirt_number: '7',
        tshirt_name: 'DHONI',
        amount: 500.0,
        payment_status: 'Paid',
        razorpay_payment_id: 'pay_mock_12345',
        created_at: new Date().toISOString()
      });
    }

    // Format fields beautifully for Excel
    const excelRows = registrations.map(reg => ({
      'Registration ID': reg.registration_id || 'Pending Validation',
      'Player Name': reg.name,
      'Mobile/Contact': reg.mobile,
      'Playing Role': reg.playing_role,
      'T-Shirt Size': reg.tshirt_size,
      'T-Shirt Number': reg.tshirt_number,
      'T-Shirt Name': reg.tshirt_name,
      'Fee Paid (₹)': reg.amount,
      'Payment Status': reg.payment_status,
      'Razorpay Payment ID': reg.razorpay_payment_id || 'N/A',
      'Registration Date': new Date(reg.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    }));

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(excelRows);

    // Calculate dynamic column widths to look super professional
    const columnWidths = Object.keys(excelRows[0]).map(key => {
      let maxLen = key.length;
      excelRows.forEach(row => {
        const cellValue = row[key] ? row[key].toString() : '';
        if (cellValue.length > maxLen) {
          maxLen = cellValue.length;
        }
      });
      return { wch: maxLen + 3 }; // Pad character spacing
    });
    worksheet['!cols'] = columnWidths;

    xlsx.utils.book_append_sheet(workbook, worksheet, 'SPL 2026 Players');

    // Generate buffer
    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=SPL_2026_Player_Registrations.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);

  } catch (error) {
    console.error('Error generating Excel sheet:', error);
    res.status(500).send('Failed to generate Excel registration sheet.');
  }
});

// Connect to database before starting server
db.connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`===========================================================`);
    console.log(` SPL 2026 Registration Server is running on port ${PORT}`);
    console.log(` Main Site: http://localhost:${PORT}`);
    console.log(` Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`===========================================================`);
  });
}).catch(err => {
  console.error('Failed to connect to MySQL database, server not started:', err.message);
});
