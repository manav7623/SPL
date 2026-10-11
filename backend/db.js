const mysql = require('mysql2/promise');

// Setup MySQL Connection Pool using environment variables
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spl_2026',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Cloud MySQL (Aiven, PlanetScale, AWS RDS) SSL configuration
if (process.env.DB_SSL === 'true' || process.env.DB_SSL === 'REQUIRED') {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = mysql.createPool(poolConfig);

/**
 * Initializes and verifies MySQL database connection & ensures table schema exists
 */
async function connectDB() {
  try {
    const connection = await pool.getConnection();
    console.log('Successfully connected to MySQL database.');

    // Ensure registrations table exists
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        registration_id VARCHAR(50) UNIQUE,
        name VARCHAR(150) NOT NULL,
        mobile VARCHAR(15) NOT NULL,
        playing_role VARCHAR(50) NOT NULL,
        tshirt_size VARCHAR(10) NOT NULL,
        tshirt_number INT NOT NULL,
        tshirt_name VARCHAR(100) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
        utr_number VARCHAR(50) UNIQUE DEFAULT NULL,
        payment_status ENUM('Pending', 'Paid', 'Failed') NOT NULL DEFAULT 'Pending',
        razorpay_order_id VARCHAR(100) UNIQUE,
        razorpay_payment_id VARCHAR(100) DEFAULT NULL,
        razorpay_signature VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_mobile (mobile),
        INDEX idx_status (payment_status),
        INDEX idx_role (playing_role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.query(createTableQuery);

    // Safely verify utr_number column exists if table existed previously
    try {
      await connection.query('ALTER TABLE registrations ADD COLUMN utr_number VARCHAR(50) UNIQUE DEFAULT NULL AFTER amount;');
    } catch (e) {
      // Column already exists, safe to ignore
    }

    connection.release();
    return pool;
  } catch (error) {
    console.error('MySQL Connection Error:', error.message);
    throw error;
  }
}

/**
 * Creates a pending registration in the MySQL database
 */
async function createRegistration({
  name,
  mobile,
  playing_role,
  tshirt_size,
  tshirt_number,
  tshirt_name,
  amount = 1.0,
  razorpay_order_id
}) {
  const [result] = await pool.execute(
    `INSERT INTO registrations 
      (name, mobile, playing_role, tshirt_size, tshirt_number, tshirt_name, amount, payment_status, razorpay_order_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
    [
      name,
      mobile,
      playing_role,
      tshirt_size,
      parseInt(tshirt_number, 10) || 0,
      tshirt_name,
      amount,
      razorpay_order_id
    ]
  );
  return result.insertId;
}

/**
 * Gets registration details by Order ID
 */
async function getRegistrationByOrderId(orderId) {
  const [rows] = await pool.execute(
    `SELECT * FROM registrations WHERE razorpay_order_id = ? LIMIT 1`,
    [orderId]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Confirms payment with UTR / Payment details and assigns unique Registration ID
 */
async function confirmPayment(orderId, paymentId, signature = 'UPI_VERIFIED', utrNumber = null) {
  const registration = await getRegistrationByOrderId(orderId);
  
  if (!registration) {
    throw new Error('Registration not found for order: ' + orderId);
  }

  // Check for duplicate UTR number across different registrations
  if (utrNumber) {
    const [existing] = await pool.execute(
      `SELECT id, registration_id FROM registrations WHERE utr_number = ? AND id != ? LIMIT 1`,
      [utrNumber, registration.id]
    );
    if (existing.length > 0) {
      throw new Error(`This UPI Reference / UTR Number (${utrNumber}) has already been used for registration.`);
    }
  }
  
  let registrationId = registration.registration_id;
  if (!registrationId) {
    // Generate sequential registration ID (e.g. SPL2026-1001)
    registrationId = `SPL2026-${1000 + registration.id}`;
  }
  
  await pool.execute(
    `UPDATE registrations
     SET payment_status = 'Paid',
         razorpay_payment_id = ?,
         razorpay_signature = ?,
         registration_id = ?,
         utr_number = ?
     WHERE razorpay_order_id = ?`,
    [paymentId, signature, registrationId, utrNumber || paymentId, orderId]
  );

  return await getRegistrationByOrderId(orderId);
}

/**
 * Allows admin to toggle payment status (Paid, Pending, Failed)
 */
async function updateRegistrationStatus(id, newStatus) {
  if (!['Paid', 'Pending', 'Failed'].includes(newStatus)) {
    throw new Error('Invalid payment status provided.');
  }

  const [rows] = await pool.execute('SELECT * FROM registrations WHERE id = ? LIMIT 1', [id]);
  if (rows.length === 0) {
    throw new Error('Player registration record not found.');
  }

  const registration = rows[0];
  let registrationId = registration.registration_id;
  if (newStatus === 'Paid' && !registrationId) {
    registrationId = `SPL2026-${1000 + registration.id}`;
  }

  await pool.execute(
    'UPDATE registrations SET payment_status = ?, registration_id = ? WHERE id = ?',
    [newStatus, registrationId, id]
  );

  return { id, payment_status: newStatus, registration_id: registrationId };
}

/**
 * Marks a payment as failed
 */
async function failPayment(orderId, errorDetails = '') {
  await pool.execute(
    `UPDATE registrations
     SET payment_status = 'Failed'
     WHERE razorpay_order_id = ? AND payment_status = 'Pending'`,
    [orderId]
  );
}

/**
 * Gets dashboard metrics summary
 */
async function getAdminStats() {
  const [rows] = await pool.query(
    `SELECT
      COUNT(*) AS totalRegistrations,
      SUM(CASE WHEN payment_status = 'Paid' THEN 1 ELSE 0 END) AS paidRegistrations,
      SUM(CASE WHEN payment_status = 'Pending' THEN 1 ELSE 0 END) AS pendingRegistrations,
      COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN amount ELSE 0 END), 0) AS totalCollection
     FROM registrations`
  );

  const stats = rows[0] || {};
  return {
    totalRegistrations: Number(stats.totalRegistrations) || 0,
    paidRegistrations: Number(stats.paidRegistrations) || 0,
    pendingRegistrations: Number(stats.pendingRegistrations) || 0,
    totalCollection: Number(stats.totalCollection) || 0
  };
}

/**
 * Gets paginated and filtered list of registrations for admin panel
 */
async function getRegistrations({ search = '', status = '', role = '', limit = 10, offset = 0 }) {
  const whereClauses = [];
  const params = [];

  if (status) {
    whereClauses.push('payment_status = ?');
    params.push(status);
  }

  if (role) {
    whereClauses.push('playing_role = ?');
    params.push(role);
  }

  if (search) {
    whereClauses.push('(name LIKE ? OR mobile LIKE ? OR registration_id LIKE ? OR tshirt_name LIKE ? OR utr_number LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get total count matching criteria
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM registrations ${whereSQL}`,
    params
  );
  const totalCount = countRows[0] ? Number(countRows[0].total) : 0;

  // Safe integers for pagination
  const safeLimit = Math.max(1, parseInt(limit, 10) || 10);
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

  // Fetch paginated players
  const [players] = await pool.query(
    `SELECT * FROM registrations ${whereSQL} ORDER BY id DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params
  );

  return {
    players,
    totalCount
  };
}

/**
 * Gets all registrations for Excel export
 */
async function getAllRegistrationsForExport() {
  const [rows] = await pool.query(
    `SELECT
      registration_id,
      name,
      mobile,
      playing_role,
      tshirt_size,
      tshirt_number,
      tshirt_name,
      amount,
      utr_number,
      payment_status,
      razorpay_payment_id,
      created_at
     FROM registrations
     ORDER BY id DESC`
  );
  return rows;
}

module.exports = {
  connectDB,
  createRegistration,
  getRegistrationByOrderId,
  confirmPayment,
  updateRegistrationStatus,
  failPayment,
  getAdminStats,
  getRegistrations,
  getAllRegistrationsForExport
};
