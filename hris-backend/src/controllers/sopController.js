import { dbQuery } from '../config/db.js';
import { config } from '../config/env.js';

export async function getSops(req, res) {
  try {
    const sops = await dbQuery.all("SELECT * FROM sops ORDER BY id DESC");
    
    // Jika pengakses adalah Karyawan (Mobile App), saring SOP secara dinamis
    if (req.user.role === 'employee') {
      const empOutlet = req.user.outlet || '';
      const empPosition = (req.user.position || '').toLowerCase();
      
      // Petakan jabatan karyawan ke tingkat sasaran: leader, admin, karyawan
      let mappedLevel = 'karyawan';
      if (empPosition === 'leader') {
        mappedLevel = 'leader';
      } else if (empPosition === 'admin') {
        mappedLevel = 'admin';
      } else if (empPosition === 'owner' || empPosition === 'master') {
        mappedLevel = 'admin'; // Owner/Master memiliki akses penuh
      }

      const filtered = sops.filter(sop => {
        // 0. Hanya tampilkan SOP yang telah dikirim (status_kirim = 1)
        if (sop.status_kirim !== 1) return false;

        // 1. Validasi Sasaran Akses Peran
        const sasaran = (sop.sasaran_role || '').toLowerCase();
        const rolesList = sasaran.split(',').map(r => r.trim());
        
        // Pemilik atau Master selalu lolos akses peran
        const hasRoleAccess = rolesList.includes(mappedLevel) || empPosition === 'owner' || empPosition === 'master';
        if (!hasRoleAccess) return false;

        // 2. Validasi Batasan Outlet Terpilih
        if (sop.hanya_outlet_terpilih === 1 || sop.hanya_outlet_terpilih === true) {
          const berlaku = (sop.berlaku_di || '');
          let outletList = [];
          
          if (berlaku.startsWith('[') && berlaku.endsWith(']')) {
            try {
              outletList = JSON.parse(berlaku);
            } catch (e) {
              outletList = berlaku.split(',').map(o => o.trim());
            }
          } else {
            outletList = berlaku.split(',').map(o => o.trim());
          }

          const hasOutletAccess = outletList.includes(empOutlet);
          if (!hasOutletAccess) return false;
        }

        return true;
      });

      return res.status(200).json({
        status: 'success',
        data: filtered
      });
    }

    // Untuk Owner/Admin pada dashboard web, kembalikan semua data SOP
    return res.status(200).json({
      status: 'success',
      data: sops
    });
  } catch (error) {
    console.error('getSops error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data SOP.'
    });
  }
}

export async function createSop(req, res) {
  const { 
    nomor, 
    judul, 
    berlaku_di, 
    jabatan_terkait, 
    isi, 
    keterangan_validasi, 
    hanya_outlet_terpilih, 
    sasaran_role, 
    tanggal_dibuat 
  } = req.body;

  if (!judul) {
    return res.status(400).json({
      status: 'error',
      message: 'Judul SOP wajib diisi.'
    });
  }

  try {
    const berlakuDiStr = Array.isArray(berlaku_di) ? JSON.stringify(berlaku_di) : berlaku_di;
    const sasaranRoleStr = Array.isArray(sasaran_role) ? sasaran_role.join(',') : sasaran_role;

    const result = await dbQuery.run(
      `INSERT INTO sops (nomor, judul, berlaku_di, jabatan_terkait, isi, keterangan_validasi, hanya_outlet_terpilih, sasaran_role, tanggal_dibuat)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nomor,
        judul.trim(),
        berlakuDiStr,
        jabatan_terkait,
        isi,
        keterangan_validasi,
        hanya_outlet_terpilih ? 1 : 0,
        sasaranRoleStr,
        tanggal_dibuat
      ]
    );

    return res.status(201).json({
      status: 'success',
      message: 'Dokumen SOP baru berhasil dibuat.',
      data: { id: result.id }
    });
  } catch (error) {
    console.error('createSop error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal membuat dokumen SOP.'
    });
  }
}

export async function updateSop(req, res) {
  const { id } = req.params;
  const { 
    nomor, 
    judul, 
    berlaku_di, 
    jabatan_terkait, 
    isi, 
    keterangan_validasi, 
    hanya_outlet_terpilih, 
    sasaran_role, 
    tanggal_dibuat 
  } = req.body;

  if (!judul) {
    return res.status(400).json({
      status: 'error',
      message: 'Judul SOP wajib diisi.'
    });
  }

  try {
    const berlakuDiStr = Array.isArray(berlaku_di) ? JSON.stringify(berlaku_di) : berlaku_di;
    const sasaranRoleStr = Array.isArray(sasaran_role) ? sasaran_role.join(',') : sasaran_role;

    const sop = await dbQuery.get("SELECT id FROM sops WHERE id = ?", [id]);
    if (!sop) {
      return res.status(404).json({
        status: 'error',
        message: 'Dokumen SOP tidak ditemukan.'
      });
    }

    await dbQuery.run(
      `UPDATE sops 
       SET nomor = ?, judul = ?, berlaku_di = ?, jabatan_terkait = ?, isi = ?, keterangan_validasi = ?, hanya_outlet_terpilih = ?, sasaran_role = ?, tanggal_dibuat = ?
       WHERE id = ?`,
      [
        nomor,
        judul.trim(),
        berlakuDiStr,
        jabatan_terkait,
        isi,
        keterangan_validasi,
        hanya_outlet_terpilih ? 1 : 0,
        sasaranRoleStr,
        tanggal_dibuat,
        id
      ]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Dokumen SOP berhasil diperbarui.'
    });
  } catch (error) {
    console.error('updateSop error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui dokumen SOP.'
    });
  }
}

export async function deleteSop(req, res) {
  const { id } = req.params;

  try {
    const sop = await dbQuery.get("SELECT id FROM sops WHERE id = ?", [id]);
    if (!sop) {
      return res.status(404).json({
        status: 'error',
        message: 'Dokumen SOP tidak ditemukan.'
      });
    }

    await dbQuery.run("DELETE FROM sops WHERE id = ?", [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Dokumen SOP berhasil dihapus.'
    });
  } catch (error) {
    console.error('deleteSop error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus dokumen SOP.'
    });
  }
}

export async function generateAiSop(req, res) {
  const { title, division } = req.body;
  if (!title) {
    return res.status(400).json({
      status: 'error',
      message: 'Judul SOP wajib diisi.'
    });
  }

  let apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const dbKeyRow = await dbQuery.get("SELECT value FROM system_settings WHERE `key` = 'gemini_api_key'");
    if (dbKeyRow && dbKeyRow.value) {
      apiKey = dbKeyRow.value;
    }
  }

  if (!apiKey) {
    return res.status(400).json({
      status: 'error',
      message: 'Kunci API Gemini belum dikonfigurasi di server.'
    });
  }

  try {
    const prompt = `Buatlah Standard Operating Procedure (SOP) operasional yang sangat profesional, mendalam, dan terstruktur untuk perusahaan ritel/kuliner Barokah Grup dengan data berikut:
- Judul SOP: "${title}"
- Jabatan Terkait: "${division || 'Semua Staf'}"

Format output harus bersih dalam bahasa Indonesia, terbagi menjadi:
1. TUJUAN
2. RUANG LINGKUP
3. PROSEDUR UTAMA (Langkah Persiapan, Pelaksanaan Inti, Penutupan & Laporan)
4. PENGAWASAN & EVALUASI
Jangan sertakan kata pengantar, penutup, atau tanda markdown tambahan. Langsung ke konten SOP.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Gemini API request failed:', errData);
      throw new Error(errData.error?.message || 'Gagal memanggil API Gemini.');
    }

    const responseData = await response.json();
    const textContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return res.status(200).json({
      status: 'success',
      content: textContent
    });
  } catch (error) {
    console.error('generateAiSop error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Gagal memproses AI generate.'
    });
  }
}

export async function sendSop(req, res) {
  const { id } = req.params;
  try {
    const result = await dbQuery.run("UPDATE sops SET status_kirim = 1 WHERE id = ?", [id]);
    if (result.changes === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Dokumen SOP tidak ditemukan.'
      });
    }
    return res.status(200).json({
      status: 'success',
      message: 'Dokumen SOP berhasil dikirim ke mobile karyawan.'
    });
  } catch (error) {
    console.error('sendSop error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengirim dokumen SOP.'
    });
  }
}

