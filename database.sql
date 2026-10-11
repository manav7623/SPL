-- =========================================================
-- SPL 2026 (Shampara Premier League) MySQL Database Schema
-- Compatible with XAMPP MySQL & phpMyAdmin
-- =========================================================

-- 1. Create Database if it does not exist
CREATE DATABASE IF NOT EXISTS `spl_2026`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2. Select Database
USE `spl_2026`;

-- 3. Create Registrations Table
CREATE TABLE IF NOT EXISTS `registrations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `registration_id` VARCHAR(50) UNIQUE DEFAULT NULL,
  `name` VARCHAR(150) NOT NULL,
  `mobile` VARCHAR(15) NOT NULL,
  `playing_role` VARCHAR(50) NOT NULL,
  `tshirt_size` VARCHAR(10) NOT NULL,
  `tshirt_number` INT NOT NULL,
  `tshirt_name` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
  `payment_status` ENUM('Pending', 'Paid', 'Failed') NOT NULL DEFAULT 'Pending',
  `razorpay_order_id` VARCHAR(100) UNIQUE DEFAULT NULL,
  `razorpay_payment_id` VARCHAR(100) DEFAULT NULL,
  `razorpay_signature` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mobile (`mobile`),
  INDEX idx_status (`payment_status`),
  INDEX idx_role (`playing_role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Sample Seed Data (Optional)
INSERT INTO `registrations` 
  (`registration_id`, `name`, `mobile`, `playing_role`, `tshirt_size`, `tshirt_number`, `tshirt_name`, `amount`, `payment_status`, `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`)
VALUES 
  ('SPL2026-1001', 'Rohit Sharma', '9876543210', 'Batsman', 'L', 45, 'ROHIT', 500.00, 'Paid', 'order_mock_1788071305349_1cd253', 'pay_mock_rohit45', 'sig_mock_rohit45')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
