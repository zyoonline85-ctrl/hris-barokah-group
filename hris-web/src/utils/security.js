/**
 * HRIS Barokah Grup - Modul Keamanan & Hak Akses
 * Centralized authorization rules for Web Admin and Mobile User.
 */

// Resolves user position/role to the 4 standardized access roles
export const getRoleFromPosition = (position, role) => {
  const pos = (position || role || '').toLowerCase();
  
  if (pos.includes('owner') || pos.includes('master') || pos.includes('chief') || pos.includes('ceo')) {
    return 'master';
  }
  if (pos.includes('leader') || pos.includes('kepala') || pos.includes('spv') || pos.includes('supervisor')) {
    return 'leader';
  }
  if (pos.includes('admin') || pos.includes('hr') || pos.includes('staff admin') || pos.includes('human resources') || pos.includes('personalia')) {
    return 'admin';
  }
  return 'user'; // ordinary employee / karyawan
};

/**
 * Helper to fetch RBAC settings from localStorage with default fallbacks
 */
export const getRbacSettings = () => {
  const defaultRbac = [
    { role: 'master', read: true, edit: true, delete: true, mobile: 'Semua Outlet', mobile_position: 'Semua Jabatan' },
    { role: 'leader', read: true, edit: true, delete: false, mobile: 'Sesuai Outlet Terdaftar', mobile_position: 'Di Bawah Jabatan' },
    { role: 'admin', read: true, edit: true, delete: false, mobile: 'Sesuai Outlet Terdaftar', mobile_position: 'Semua Jabatan' }
  ];
  
  try {
    const stored = localStorage.getItem('rbac_settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Automatically upgrade/fix admin edit permission to true
      let updated = false;
      const list = parsed.map(row => {
        if (row.role === 'admin' && row.edit === false) {
          row.edit = true;
          updated = true;
        }
        return row;
      });
      if (updated) {
        localStorage.setItem('rbac_settings', JSON.stringify(list));
      }
      
      const lookup = {};
      list.forEach(row => {
        lookup[row.role] = row;
      });
      return lookup;
    }
  } catch (e) {
    console.error('Failed to load rbac_settings:', e);
  }

  // Fallback to default lookup
  const lookup = {};
  defaultRbac.forEach(row => {
    lookup[row.role] = row;
  });
  return lookup;
};

/**
 * 1. Web Based Admin Access Guard (Dynamic RBAC)
 * Master: Full access (Read, Edit, Delete) - Always true
 * Leader/Admin: Dynamically fetched from localStorage
 */
export const checkAccess = (user, action) => {
  const role = getRoleFromPosition(user?.position, user?.role);
  
  if (role === 'master') {
    return true; // Master has absolute access bypass
  }

  const rbac = getRbacSettings();
  const roleSettings = rbac[role];
  if (!roleSettings) {
    return false; // Unknown role is blocked
  }

  // Map incoming action to dynamic rbac settings fields
  if (action === 'read') {
    return !!roleSettings.read;
  }
  if (action === 'edit' || action === 'write') {
    return !!roleSettings.edit;
  }
  if (action === 'delete') {
    return !!roleSettings.delete;
  }

  return false;
};

/**
 * 2. Mobile User Access Guard (Android App) (Dynamic RBAC)
 * Checked based on mobile access scope (Semua Outlet vs Sesuai Outlet Terdaftar) and Jabatan
 */
export const checkAccessMobile = (user, targetEmployee, targetOutlet) => {
  const role = getRoleFromPosition(user?.position, user?.role);
  const rbac = getRbacSettings();
  const roleSettings = rbac[role] || { 
    read: true, 
    edit: false, 
    delete: false, 
    mobile: 'Sesuai Outlet Terdaftar',
    mobile_position: 'Hanya Data Pribadi'
  };
  
  const mobileScope = roleSettings.mobile;
  const positionScope = roleSettings.mobile_position || 'Hanya Data Pribadi';

  // 1. Check Outlet Scope
  let outletAllowed = false;
  if (mobileScope === 'Semua Outlet') {
    outletAllowed = true;
  } else {
    // Sesuai Outlet Terdaftar
    const userOutlet = (user?.outlet || '').trim().toLowerCase();
    const targetOutletLower = (targetOutlet || '').trim().toLowerCase();
    outletAllowed = userOutlet && userOutlet === targetOutletLower;
  }

  if (!outletAllowed) {
    return {
      allowed: false,
      reason: `Akses Ditolak! Satpam HP memblokir aksi! Peran ${role.toUpperCase()} di outlet ${user?.outlet || 'Cabang A'} dilarang mengakses data outlet ${targetOutlet || 'Cabang B'}.`
    };
  }

  // 2. Check Position / Jabatan Scope
  const targetRole = getRoleFromPosition(targetEmployee?.position, targetEmployee?.role);
  const isSelf = String(user?.id) === String(targetEmployee?.id || targetEmployee);

  if (positionScope === 'Semua Jabatan') {
    return {
      allowed: true,
      reason: `Akses Diberikan: Peran ${role.toUpperCase()} diizinkan mengakses data semua jabatan di cabang ini.`
    };
  }

  if (positionScope === 'Di Bawah Jabatan') {
    // Can view subordinate positions, or their own data
    const isSub = (role === 'leader' && targetRole === 'user') || 
                  (role === 'admin' && (targetRole === 'user' || targetRole === 'leader'));
    if (isSelf || isSub) {
      return {
        allowed: true,
        reason: isSelf 
          ? 'Akses Diberikan: Diizinkan melihat data pribadi miliknya sendiri.'
          : 'Akses Diberikan: Diizinkan melihat data bawahan di cabang ini.'
      };
    } else {
      return {
        allowed: false,
        reason: `Akses Ditolak! Satpam HP memblokir aksi! Peran ${role.toUpperCase()} dilarang mengakses data rekan dengan jabatan setara/lebih tinggi (${targetEmployee?.position || 'Leader/Master'}).`
      };
    }
  }

  if (positionScope === 'Hanya Data Pribadi') {
    if (isSelf) {
      return {
        allowed: true,
        reason: 'Akses Diberikan: Diizinkan melihat data pribadi miliknya sendiri di cabang tempat dia ditugaskan.'
      };
    } else {
      return {
        allowed: false,
        reason: `Akses Ditolak! Satpam HP memblokir aksi! Peran ${role.toUpperCase()} dibatasi hanya untuk melihat data pribadi saja.`
      };
    }
  }

  return {
    allowed: false,
    reason: 'Akses Ditolak! Pelanggaran aturan keamanan Jabatan/Outlet.'
  };
};
