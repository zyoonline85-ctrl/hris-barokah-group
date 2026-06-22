import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { dbQuery } from '../config/db.js';

/**
 * Middleware untuk memverifikasi JWT Token
 */
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <TOKEN>

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Akses ditolak: Token autentikasi tidak disertakan.'
    });
  }

  // Bypass untuk local-admin-token dari Web Admin
  if (token === 'local-admin-token') {
    req.user = {
      id: 9999,
      email: 'admin@hris.local',
      role: 'owner',
      employeeId: 9999,
      position: 'owner',
      outlet: 'ALL OUTLETS'
    };
    return next();
  }

  // Bypass untuk local-employee-token dari Web Admin
  if (token && token.startsWith('local-employee-token-')) {
    const empId = parseInt(token.replace('local-employee-token-', ''), 10);
    try {
      const user = await dbQuery.get(
        `SELECT u.id, u.email, u.role, e.id as employee_id, e.position, e.outlet 
         FROM users u 
         LEFT JOIN employees e ON e.user_id = u.id 
         WHERE e.id = ? LIMIT 1`,
        [empId]
      );
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          employeeId: user.employee_id,
          position: user.position,
          outlet: user.outlet
        };
      } else {
        req.user = {
          id: empId,
          email: 'employee@hris.local',
          role: 'admin',
          employeeId: empId,
          position: 'admin',
          outlet: 'ALL OUTLETS'
        };
      }
      return next();
    } catch (err) {
      req.user = {
        id: empId,
        email: 'employee@hris.local',
        role: 'admin',
        employeeId: empId,
        position: 'admin',
        outlet: 'ALL OUTLETS'
      };
      return next();
    }
  }

  // Bypass untuk MockToken dari aplikasi mobile/HP testing
  if (token === 'MockToken') {
    try {
      const user = await dbQuery.get(
        `SELECT u.id, u.email, u.role, e.id as employee_id, e.position, e.outlet 
         FROM users u 
         LEFT JOIN employees e ON e.user_id = u.id 
         WHERE u.id = 2 OR u.email = 'admin@hris.com' LIMIT 1`
      );

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          employeeId: user.employee_id,
          position: user.position,
          outlet: user.outlet
        };
      } else {
        req.user = {
          id: 2,
          email: 'admin@hris.com',
          role: 'admin',
          employeeId: 2,
          position: 'Admin Personalia',
          outlet: 'AYAM PECAK 2001 SEAFOOD TEBING TINGGI'
        };
      }
      return next();
    } catch (err) {
      req.user = {
        id: 2,
        email: 'admin@hris.com',
        role: 'admin',
        employeeId: 2,
        position: 'Admin Personalia',
        outlet: 'AYAM PECAK 2001 SEAFOOD TEBING TINGGI'
      };
      return next();
    }
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Periksa apakah user masih aktif di database
    const user = await dbQuery.get(
      `SELECT u.id, u.email, u.role, e.id as employee_id, e.position, e.outlet 
       FROM users u 
       LEFT JOIN employees e ON e.user_id = u.id 
       WHERE u.id = ?`,
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Akses ditolak: Sesi tidak valid atau pengguna telah dihapus.'
      });
    }

    // Pasang data user ke objek request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employee_id,
      position: user.position,
      outlet: user.outlet
    };

    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(403).json({
      status: 'error',
      message: 'Akses ditolak: Sesi kedaluwarsa atau token tidak valid.'
    });
  }
}

/**
 * Middleware untuk otorisasi berdasarkan Role (RBAC)
 * @param {string[]} allowedRoles - Daftar role yang diizinkan mengakses
 */
export function authorizeRoles(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Akses ditolak: Membutuhkan autentikasi.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Anda tidak memiliki wewenang untuk mengakses halaman ini.'
      });
    }

    next();
  };
}
