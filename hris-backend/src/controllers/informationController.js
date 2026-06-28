import { dbQuery } from '../config/db.js';

/**
 * Mengambil daftar informasi/pengumuman untuk karyawan aktif
 */
export async function getInformations(req, res) {
  try {
    const employeeId = req.user.employeeId;
    if (!employeeId) {
      return res.status(400).json({
        status: 'error',
        message: 'Akses ditolak: ID Karyawan tidak teridentifikasi.'
      });
    }

    // Ambil broadcast/informasi dari database MySQL
    const rows = await dbQuery.all(
      `SELECT id, title, message, outlet, created_at, is_read, response, read_at
       FROM mobile_user_notifications
       WHERE employee_id = ? AND type = 'broadcast'
       ORDER BY created_at DESC`,
      [employeeId]
    );

    // Map database rows to InformationRecord model format expected by client
    const data = rows.map(row => ({
      id: Number(row.id),
      kategori: 'Pengumuman',
      judul: row.title || 'Notifikasi',
      isi_informasi: row.message || '',
      hanya_outlet_terpilih: row.outlet ? 1 : 0,
      berlaku_di: row.outlet || 'Semua Outlet',
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      is_read: row.is_read === 1,
      response: row.response || null,
      read_at: row.read_at ? new Date(row.read_at).toISOString() : null
    }));

    let dailyMotivation = 'Tetap semangat bekerja demi Barokah Grup!';
    try {
      const row = await dbQuery.get("SELECT value FROM system_settings WHERE `key` = 'daily_motivation'");
      if (row && row.value) {
        dailyMotivation = row.value;
      }
    } catch (_) {}

    return res.status(200).json({
      status: 'success',
      data,
      daily_motivation: dailyMotivation
    });
  } catch (error) {
    console.error('getInformations error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data papan informasi.'
    });
  }
}

/**
 * Menandai informasi dibaca dengan menyertakan feedback respon
 */
export async function markInformationRead(req, res) {
  const { id } = req.params;
  const { response } = req.body; // e.g. 'siap' or 'tanya_admin'
  const employeeId = req.user.employeeId;

  if (!employeeId) {
    return res.status(400).json({
      status: 'error',
      message: 'Akses ditolak: ID Karyawan tidak teridentifikasi.'
    });
  }

  try {
    const notif = await dbQuery.get(
      "SELECT id FROM mobile_user_notifications WHERE id = ? AND employee_id = ? AND type = 'broadcast'",
      [id, employeeId]
    );

    if (!notif) {
      return res.status(404).json({
        status: 'error',
        message: 'Informasi tidak ditemukan.'
      });
    }

    await dbQuery.run(
      `UPDATE mobile_user_notifications 
       SET is_read = 1, response = ?, read_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [response || 'siap', id]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Informasi berhasil ditandai dibaca.'
    });
  } catch (error) {
    console.error('markInformationRead error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menandai informasi dibaca.'
    });
  }
}

/**
  * Generate daily motivation quote using Gemini AI
  */
export async function generateMotivation(req, res) {
  const { tone } = req.body;
  
  // Read Gemini API key
  let apiKey = process.env.GEMINI_API_KEY;
  try {
    const dbKeyRow = await dbQuery.get("SELECT value FROM system_settings WHERE `key` = 'gemini_api_key'");
    if (dbKeyRow && dbKeyRow.value) {
      apiKey = dbKeyRow.value;
    }
  } catch (_) {}

  if (!apiKey) {
    return res.status(400).json({
      status: 'error',
      message: 'Kunci API Gemini belum dikonfigurasi di server.'
    });
  }

  try {
    const toneText = tone ? `dengan nada ${tone}` : 'penuh semangat, inspiratif, dan ramah';
    const prompt = `Tulis sebuah kalimat motivasi kerja singkat ${toneText} untuk karyawan Barokah Grup (sebuah grup restoran kuliner terkenal). Maksimal 15 kata. Berbahasa Indonesia yang sopan dan ramah. Jangan sertakan tanda petik, penjelasan, atau teks tambahan. Langsung berikan kutipannya.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!response.ok) {
      throw new Error('Gagal memanggil API Gemini.');
    }

    const responseData = await response.json();
    const textContent = (responseData.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().replace(/^"|"$/g, '');
    
    return res.status(200).json({
      status: 'success',
      motivation: textContent
    });
  } catch (error) {
    console.error('generateMotivation error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal membuat motivasi dengan AI.'
    });
  }
}

/**
  * Save daily motivation quote to system_settings
  */
export async function updateMotivation(req, res) {
  const { motivation } = req.body;
  if (!motivation) {
    return res.status(400).json({
      status: 'error',
      message: 'Teks motivasi tidak boleh kosong.'
    });
  }

  try {
    const row = await dbQuery.get("SELECT * FROM system_settings WHERE `key` = 'daily_motivation'");
    if (row) {
      await dbQuery.run("UPDATE system_settings SET value = ? WHERE `key` = 'daily_motivation'", [motivation]);
    } else {
      await dbQuery.run("INSERT INTO system_settings (`key`, value, description) VALUES ('daily_motivation', ?, 'Kalimat sapaan/motivasi harian untuk karyawan')", [motivation]);
    }

    return res.status(200).json({
      status: 'success',
      message: 'Motivasi harian berhasil diperbarui dan disebarkan ke mobile APK.'
    });
  } catch (error) {
    console.error('updateMotivation error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui motivasi.'
    });
  }
}
