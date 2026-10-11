# 🏏 SPL 2026 - Saurashtra Premier League Registration Portal

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-blue.svg)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-orange.svg)](https://www.mysql.com/)
[![Deploy on Render](https://img.shields.io/badge/Deploy-Render-46E3B7.svg)](https://render.com/)
[![Deploy with Vercel](https://img.shields.io/badge/Deploy-Vercel-black.svg)](https://vercel.com/)

A modern, full-stack Player Registration and Admin Tournament Management Portal built for the **Saurashtra Premier League (SPL 2026)**.

---

## 📑 Table of Contents
1. [Key Features](#-key-features)
2. [Tech Stack](#-tech-stack)
3. [Project Structure](#-project-structure)
4. [Local Development (XAMPP MySQL)](#-local-development-xampp-mysql)
5. [Cloud Database Setup (Aiven MySQL)](#-cloud-database-setup-aiven-mysql)
6. [Deployment on Render (Recommended)](#-deployment-on-render-recommended)
7. [Deployment on Vercel](#-deployment-on-vercel)
8. [Environment Variables Reference](#-environment-variables-reference)
9. [Admin Credentials & Testing](#-admin-credentials--testing)
10. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## ✨ Key Features

- **⚡ Player Registration Flow:**
  - Responsive, modern registration form with live input validation.
  - T-shirt size picker, jersey number assignment, and custom name printing.
  - Playing role selector (Batsman, Bowler, All-rounder, Wicket Keeper).
- **💳 Payment Gateway (Razorpay):**
  - **Live Mode:** Real UPI, Cards, NetBanking via Razorpay.
  - **Developer Mock Mode:** Built-in simulated payment flow for instant testing without debiting real money (`USE_MOCK_PAYMENT=true`).
- **🎫 Unique Registration ID:**
  - Automated atomic serial number generation (e.g. `SPL2026-1001`, `SPL2026-1002`).
- **🛡️ Admin Management Dashboard:**
  - Real-time tournament metrics (Total Registrations, Paid, Pending, Total Amount Collected).
  - Search by name, mobile, registration ID, or jersey name.
  - Filter players by payment status and playing role.
  - Pagination support.
  - **Single-Click Excel Export (`.xlsx`):** Generates structured spreadsheets formatted for tournament organizers.
  - Secure session-based authentication.
- **🗄️ Database:**
  - MySQL with connection pooling (`mysql2/promise`).
  - Compatible with local XAMPP and managed cloud databases (Aiven, AWS RDS, PlanetScale).

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Backend** | Node.js, Express.js 5.x |
| **Database Driver** | `mysql2` (Connection Pool + Promises) |
| **Frontend** | Semantic HTML5, CSS3, Vanilla ES6+ JavaScript |
| **Icons & Fonts** | FontAwesome 6, Google Fonts (Inter / Outfit) |
| **Excel Export** | `xlsx` (SheetJS) |
| **Authentication** | `express-session` |
| **Cloud Hosting** | Render / Vercel |
| **Cloud Database** | Aiven (Managed MySQL) |

---

## 📂 Project Structure

```text
SPL/
├── .gitignore               # Excludes .env, node_modules, and *.db
├── README.md                # Comprehensive documentation
├── database.sql             # MySQL schema & sample seed data
├── vercel.json              # Serverless configuration for Vercel deployment
├── backend/
│   ├── .env.example         # Template for environment variables
│   ├── db.js                # MySQL pool connection and query handler
│   ├── package.json         # Backend dependencies & npm scripts
│   └── server.js            # Express API, auth routes & static server
└── frontend/
    ├── index.html           # Main player registration page
    ├── style.css            # Responsive tournament UI theme
    ├── app.js               # Frontend validation & payment modal logic
    ├── admin.html           # Admin login & tournament dashboard UI
    ├── admin.js             # Dashboard metrics, search, and table logic
    └── assets/              # Banners, gallery photos, and tournament images
```

---

## 💻 Local Development (XAMPP MySQL)

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [XAMPP](https://www.apachefriends.org/) (with Apache and MySQL)

### 2. Setup Local Database
1. Open **XAMPP Control Panel** and start **Apache** and **MySQL**.
2. Open **phpMyAdmin** in your browser: [http://localhost/phpmyadmin](http://localhost/phpmyadmin)
3. Click on the **SQL** tab and execute the contents of `database.sql`:
   ```sql
   CREATE DATABASE IF NOT EXISTS spl_2026;
   USE spl_2026;
   -- (Paste the full contents of database.sql and run)
   ```

### 3. Run the Backend
1. Open terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Verify your `.env` contains:
   ```env
   PORT=3000
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin_spl_2026
   SESSION_SECRET=spl_2026_super_secret_session_key
   USE_MOCK_PAYMENT=true

   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=spl_2026
   DB_PORT=3306
   DB_SSL=false
   ```
5. Start the server:
   ```bash
   npm start
   ```
6. Open in your browser:
   - **Registration Portal:** [http://localhost:3000](http://localhost:3000)
   - **Admin Dashboard:** [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## ☁️ Cloud Database Setup (Aiven MySQL)

> [!IMPORTANT]
> Cloud hosting services like **Render** and **Vercel** run on remote cloud servers and **cannot access your local XAMPP (`localhost`)**. You need a cloud MySQL database. **Aiven** offers a free managed MySQL service with SSL.

### Step 1: Create an Aiven Account & MySQL Service
1. Go to [https://aiven.io](https://aiven.io) and sign up for a free account.
2. In the Aiven Console, click **Create Service**.
3. Select **MySQL**.
4. Choose the **Free Plan** (or trial tier) and select a cloud region close to you (e.g., `AWS - Singapore` or `GCP - Mumbai/Frankfurt`).
5. Set the service name to `spl-mysql` and click **Create Service**.

### Step 2: Create the `spl_2026` Database in Aiven
1. In your Aiven MySQL dashboard, click on the **Databases** tab.
2. Click **Add Database** and name it `spl_2026`.

### Step 3: Import Schema (`database.sql`)
1. From the Aiven **Overview** tab, copy your **Connection Information**:
   - **Host** (e.g. `spl-mysql-project.aivencloud.com`)
   - **Port** (e.g. `12345`)
   - **User** (usually `avnadmin`)
   - **Password** (click to reveal)
2. Import the `database.sql` schema:
   * **Via MySQL CLI:**
     ```bash
     mysql -h <HOST> -P <PORT> -u avnadmin -p spl_2026 < database.sql
     ```
   * **Or via MySQL Workbench / DBeaver:** Connect using the Aiven credentials with SSL enabled and execute `database.sql`.

---

## 🚀 Deployment on Render (Recommended)

Render is the ideal choice for full-stack Node.js + Express applications with persistent sessions and static asset serving.

### Step-by-Step Render Deployment:
1. Push your latest code to your GitHub repository:
   ```bash
   git push origin main
   ```
2. Log in to [https://render.com](https://render.com) and click **New + > Web Service**.
3. Choose **Build and deploy from a Git repository** and connect `manav7623/SPL`.
4. Configure the service settings:
   - **Name:** `spl-registration`
   - **Region:** Singapore / Frankfurt (or same region as your Aiven DB)
   - **Branch:** `main`
   - **Root Directory:** *(leave blank)*
   - **Runtime:** `Node`
   - **Build Command:**
     ```bash
     cd backend && npm install
     ```
   - **Start Command:**
     ```bash
     cd backend && node server.js
     ```
   - **Instance Type:** `Free`
5. Scroll down to **Environment Variables** and add the following keys:
   | Key | Value | Description |
   |---|---|---|
   | `PORT` | `3000` | (Render assigns this automatically, but safe to set) |
   | `DB_HOST` | `<Aiven Service Host>` | e.g. `mysql-xxx.aivencloud.com` |
   | `DB_PORT` | `<Aiven Port>` | e.g. `12345` |
   | `DB_USER` | `avnadmin` | Aiven username |
   | `DB_PASSWORD` | `<Aiven Password>` | Aiven database password |
   | `DB_NAME` | `spl_2026` | Database name |
   | `DB_SSL` | `true` | **Enables SSL required by Aiven** |
   | `ADMIN_USERNAME`| `admin` | Your chosen admin username |
   | `ADMIN_PASSWORD`| `your_secure_password` | Your admin password |
   | `SESSION_SECRET`| `random_secure_32_character_string` | Secret key for login sessions |
   | `USE_MOCK_PAYMENT`| `true` | Set `false` when Razorpay keys are added |
   | `RAZORPAY_KEY_ID`| *(Optional)* | Razorpay Key ID |
   | `RAZORPAY_KEY_SECRET`| *(Optional)* | Razorpay Secret Key |
6. Click **Create Web Service**.
7. Wait 2-3 minutes for the build to finish. Render will provide a live URL like:
   `https://spl-registration.onrender.com`

---

## ⚡ Deployment on Vercel

The repository includes a ready-to-use `vercel.json` file configuring the Express app as a serverless backend.

### Step-by-Step Vercel Deployment:
1. Log in to [https://vercel.com](https://vercel.com).
2. Click **Add New > Project** and select `manav7623/SPL` from GitHub.
3. In **Project Settings**:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./`
4. Expand **Environment Variables** and add:
   ```text
   DB_HOST=<Your Aiven Host>
   DB_PORT=<Your Aiven Port>
   DB_USER=<Your Aiven User>
   DB_PASSWORD=<Your Aiven Password>
   DB_NAME=spl_2026
   DB_SSL=true
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your_secure_password
   SESSION_SECRET=your_session_secret_key
   USE_MOCK_PAYMENT=true
   ```
5. Click **Deploy**.
6. Once deployed, open your Vercel URL (e.g. `https://spl-xxxx.vercel.app`).

---

## 🔑 Environment Variables Reference

| Variable | Default (Local) | Cloud (Aiven / Render / Vercel) | Purpose |
|---|---|---|---|
| `PORT` | `3000` | Auto | Server port |
| `DB_HOST` | `localhost` | `xxx.aivencloud.com` | MySQL host address |
| `DB_PORT` | `3306` | Aiven port (e.g. `12345`) | MySQL port |
| `DB_USER` | `root` | `avnadmin` | MySQL username |
| `DB_PASSWORD` | `""` (empty) | Your Aiven password | MySQL password |
| `DB_NAME` | `spl_2026` | `spl_2026` | Database schema name |
| `DB_SSL` | `false` | `true` | Required for secure cloud MySQL |
| `ADMIN_USERNAME` | `admin` | Custom | Admin login username |
| `ADMIN_PASSWORD` | `admin_spl_2026` | Custom strong password | Admin login password |
| `SESSION_SECRET` | `spl_2026...` | Long random string | Secret for cookies |
| `USE_MOCK_PAYMENT`| `true` | `true` or `false` | Bypass Razorpay API for testing |
| `RAZORPAY_KEY_ID` | `""` | `rzp_live_...` | Live Razorpay Key |
| `RAZORPAY_KEY_SECRET` | `""` | `...` | Live Razorpay Secret |

---

## 🔐 Admin Credentials & Testing

- **Admin Login Page:** `/admin.html`
- **Default Username:** `admin`
- **Default Password:** `admin_spl_2026` *(change this in production)*
- **Dashboard Capabilities:**
  - View live counters: Total players, paid registrations, and total revenue.
  - Search any player by name, phone number, or jersey number.
  - Filter players by role (e.g., Bowlers, Batsmen).
  - Download official Excel report by clicking **"Export to Excel"**.

---

## ❓ Troubleshooting & FAQs

### 1. "Failed to connect to MySQL database, server not started"
- **Local:** Ensure XAMPP MySQL is started in the XAMPP Control Panel.
- **Cloud (Render/Vercel):** Make sure `DB_SSL=true` is set in your environment variables when using Aiven or any managed cloud database.

### 2. Can I use real Razorpay payments?
Yes! In your Render or Vercel environment variables:
1. Set `USE_MOCK_PAYMENT=false`.
2. Provide your actual `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` from your Razorpay Dashboard.

### 3. Render Free Tier takes ~40 seconds to open on first visit
Render's free tier spins down web services after 15 minutes of inactivity. The first request will wake up the server (this is normal behavior for free tier hosting). Subsequent requests are instant.

---

## 👨‍💻 Author & License

- **Developer:** [Manav Dhameliya](https://github.com/manav7623)
- **License:** ISC
