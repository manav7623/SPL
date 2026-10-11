# 🏏 SPL 2026 - Saurashtra Premier League Registration Portal

A complete player registration and admin management system for the Saurashtra Premier League (SPL 2026) built with Node.js, Express, MySQL (XAMPP), and Vanilla JavaScript.

---

## 🚀 Features

- **Player Registration Form:** Responsive UI with real-time validation (T-shirt selection, jersey number, playing role).
- **Payment Gateway Integration:** Razorpay integration with built-in Developer Mock Mode for testing without actual money deductions.
- **Unique Registration IDs:** Automatically generated sequential player IDs (e.g., `SPL2026-1001`).
- **Admin Dashboard:**
  - Real-time statistics (Total Registrations, Paid, Pending, Total Collections).
  - Search, filter by role/payment status, and pagination.
  - Excel Export (`.xlsx`) of all player registrations with a single click.
  - Secure session-based admin authentication.
- **Database:** MySQL database backend compatible with XAMPP & phpMyAdmin.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js, `mysql2`, `express-session`, `xlsx`
- **Frontend:** HTML5, CSS3, JavaScript (ES6+), FontAwesome
- **Database:** MySQL (via XAMPP)
- **Payment Gateway:** Razorpay (Live & Mock mode supported)

---

## 📦 Setup & Installation

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [XAMPP](https://www.apachefriends.org/) (with MySQL and Apache running)

### 2. Database Setup (XAMPP)
1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Open **phpMyAdmin** at [http://localhost/phpmyadmin](http://localhost/phpmyadmin).
3. Import `database.sql` or run the queries inside it to create the `spl_2026` database and `registrations` table.

### 3. Backend Setup
1. Open terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Configure database and credentials in `.env`:
   ```env
   PORT=3000
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin_spl_2026
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=spl_2026
   DB_PORT=3306
   USE_MOCK_PAYMENT=true
   ```

### 4. Run the Project
Start the server:
```bash
npm start
```
Or for development with auto-reload:
```bash
npm run dev
```

- **Player Registration Portal:** [http://localhost:3000](http://localhost:3000)
- **Admin Panel:** [http://localhost:3000/admin.html](http://localhost:3000/admin.html)
  - Default Username: `admin`
  - Default Password: `admin_spl_2026`
