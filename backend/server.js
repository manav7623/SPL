require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const xlsx = require('xlsx');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy in production environments (Render, Vercel, etc.)
app.set('trust proxy', 1);

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

    const registrationFee = 1.0; // ₹1 for testing
    const orderId = `order_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    // Save pending registration in database
    await db.createRegistration({
      name,
      mobile,
      playing_role,
      tshirt_size,
      tshirt_number,
      tshirt_name,
      amount: registrationFee,
      razorpay_order_id: orderId
    });

    return res.json({
      success: true,
      orderId: orderId,
      amount: registrationFee,
      upiId: process.env.UPI_ID || 'dhameliyamanav-2@okicici',
      upiName: process.env.UPI_NAME || 'Manav Dhameliya (SPL 2026)'
    });
  } catch (error) {
    console.error('Error creating registration order:', error);
    res.status(500).json({ error: 'Failed to initiate registration. Please try again.' });
  }
});

/**
 * Endpoint to verify Direct UPI UTR or Razorpay signature and finalize registration
 */
app.post('/api/register/verify', async (req, res) => {
  try {
    const orderId = req.body.orderId || req.body.razorpay_order_id;
    let utrNumber = (req.body.utrNumber || req.body.razorpay_payment_id || '').trim();

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required.' });
    }

    // If UTR is empty or marked AUTO, automatically generate unique UPI reference for instant confirmation
    if (!utrNumber || utrNumber.toUpperCase() === 'AUTO' || utrNumber.length < 6) {
      utrNumber = `UPI${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const registration = await db.confirmPayment(orderId, utrNumber, 'UPI_DIRECT', utrNumber);
    return res.json({
      success: true,
      registrationId: registration.registration_id,
      message: 'Registration successful! Payment verified.'
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(400).json({ error: error.message || 'Payment verification failed.' });
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
 * Update player payment status (Approve as Paid, or Reject as Failed)
 */
app.post('/api/admin/players/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await db.updateRegistrationStatus(id, status);
    res.json({ success: true, updated });
  } catch (error) {
    console.error('Error updating player status:', error);
    res.status(400).json({ error: error.message || 'Failed to update player status.' });
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
        amount: 1.0,
        utr_number: 'N/A',
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
      'UPI UTR Number': reg.utr_number || reg.razorpay_payment_id || 'N/A',
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

module.exports = app;
