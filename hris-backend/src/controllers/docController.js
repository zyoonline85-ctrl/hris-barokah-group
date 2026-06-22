import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import { dbQuery } from '../config/db.js';

const uploadDir = path.resolve('uploads');

// Buat direktori uploads jika belum ada
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Mengambil daftar seluruh arsip dokumentasi
 */
export async function getDocumentations(req, res) {
  try {
    let sql = "SELECT * FROM documentations";
    const params = [];

    if (req.user && req.user.role === 'employee') {
      sql += " WHERE status = 'aktif' AND status_kirim = 1";
    }

    sql += " ORDER BY tanggal_publish DESC, judul ASC";

    const docs = await dbQuery.all(sql, params);

    // Filter secara dinamis untuk karyawan berdasarkan outlet dan jabatan
    if (req.user && req.user.role === 'employee') {
      const empOutlet = req.user.outlet || '';
      const empPosition = (req.user.position || '').toLowerCase();
      
      const filtered = docs.filter(doc => {
        // 1. Validasi Jabatan Terkait
        if (doc.jabatan_terkait) {
          let positionsList = [];
          try {
            if (doc.jabatan_terkait.startsWith('[') && doc.jabatan_terkait.endsWith(']')) {
              positionsList = JSON.parse(doc.jabatan_terkait);
            } else {
              positionsList = doc.jabatan_terkait.split(',').map(p => p.trim());
            }
          } catch (e) {
            positionsList = doc.jabatan_terkait.split(',').map(p => p.trim());
          }
          
          const hasPositionAccess = positionsList.map(p => p.toLowerCase()).includes(empPosition) || 
                                    empPosition === 'owner' || 
                                    empPosition === 'master';
          if (!hasPositionAccess) return false;
        }

        // 2. Validasi Berlaku Di Outlet
        if (doc.berlaku_di) {
          let outletList = [];
          try {
            if (doc.berlaku_di.startsWith('[') && doc.berlaku_di.endsWith(']')) {
              outletList = JSON.parse(doc.berlaku_di);
            } else {
              outletList = doc.berlaku_di.split(',').map(o => o.trim());
            }
          } catch (e) {
            outletList = doc.berlaku_di.split(',').map(o => o.trim());
          }
          
          const hasOutletAccess = outletList.includes(empOutlet) || 
                                  empPosition === 'owner' || 
                                  empPosition === 'master';
          if (!hasOutletAccess) return false;
        }

        return true;
      });

      return res.status(200).json({
        status: 'success',
        data: filtered
      });
    }

    return res.status(200).json({
      status: 'success',
      data: docs
    });
  } catch (error) {
    console.error('getDocumentations error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data dokumentasi.'
    });
  }
}

/**
 * Membuat data dokumentasi baru beserta unggah file base64
 */
export async function createDocumentation(req, res) {
  const { judul, isi, fileData, fileName, berlaku_di, jabatan_terkait } = req.body;

  if (!judul || !isi) {
    return res.status(400).json({
      status: 'error',
      message: 'Judul dan isi rangkuman wajib diisi.'
    });
  }

  try {
    let savedFileName = null;
    let savedFilePath = null;

    // Proses data berkas base64 jika dilampirkan
    if (fileData && fileName) {
      const ext = path.extname(fileName).toLowerCase();
      if (!['.pdf', '.xls', '.xlsx'].includes(ext)) {
        return res.status(400).json({
          status: 'error',
          message: 'Hanya berkas PDF, XLS, atau XLSX yang diizinkan.'
        });
      }

      // Bersihkan dan buat nama file teracak yang unik & aman
      const randomName = `doc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      savedFileName = path.basename(fileName); // Simpan nama asli untuk display
      savedFilePath = randomName; // Path relatif yang teracak untuk keamanan

      const targetPath = path.join(uploadDir, randomName);
      
      // Keamanan: Validasi batas direktori untuk mencegah directory traversal
      if (!targetPath.startsWith(uploadDir + path.sep)) {
        return res.status(400).json({
          status: 'error',
          message: 'Penyimpanan file tidak valid (Directory Traversal Terdeteksi).'
        });
      }

      // Decode base64 dan simpan berkas
      const buffer = Buffer.from(fileData, 'base64');
      
      // Keamanan: batasi ukuran file maksimal 5MB
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({
          status: 'error',
          message: 'Ukuran berkas melebihi batas maksimal 5MB.'
        });
      }

      fs.writeFileSync(targetPath, buffer);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const berlakuDiStr = Array.isArray(berlaku_di) ? JSON.stringify(berlaku_di) : berlaku_di;
    const jabatanTerkaitStr = Array.isArray(jabatan_terkait) ? JSON.stringify(jabatan_terkait) : jabatan_terkait;

    const result = await dbQuery.run(
      "INSERT INTO documentations (tanggal_publish, judul, isi, file_name, file_path, status, status_kirim, berlaku_di, jabatan_terkait) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [todayStr, judul.trim(), isi.trim(), savedFileName, savedFilePath, 'aktif', 0, berlakuDiStr, jabatanTerkaitStr]
    );

    return res.status(201).json({
      status: 'success',
      message: 'Dokumen baru berhasil disimpan.',
      data: {
        id: result.id,
        tanggal_publish: todayStr,
        judul,
        isi,
        file_name: savedFileName,
        file_path: savedFilePath,
        status: 'aktif'
      }
    });
  } catch (error) {
    console.error('createDocumentation error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menambahkan dokumentasi baru.'
    });
  }
}

/**
 * Memperbarui data dokumentasi beserta opsi ganti file
 */
export async function updateDocumentation(req, res) {
  const { id } = req.params;
  const { judul, isi, fileData, fileName, status, berlaku_di, jabatan_terkait } = req.body;

  if (!judul || !isi) {
    return res.status(400).json({
      status: 'error',
      message: 'Judul dan isi rangkuman wajib diisi.'
    });
  }

  try {
    const doc = await dbQuery.get("SELECT * FROM documentations WHERE id = ?", [id]);
    if (!doc) {
      return res.status(404).json({
        status: 'error',
        message: 'Dokumentasi tidak ditemukan.'
      });
    }

    let savedFileName = doc.file_name;
    let savedFilePath = doc.file_path;

    // Update berkas jika ada base64 baru
    if (fileData && fileName) {
      const ext = path.extname(fileName).toLowerCase();
      if (!['.pdf', '.xls', '.xlsx'].includes(ext)) {
        return res.status(400).json({
          status: 'error',
          message: 'Hanya berkas PDF, XLS, atau XLSX yang diizinkan.'
        });
      }

      // Hapus file lama jika ada
      if (doc.file_path) {
        const oldPath = path.join(uploadDir, path.basename(doc.file_path));
        if (fs.existsSync(oldPath) && oldPath.startsWith(uploadDir + path.sep)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {
            console.error('Gagal menghapus berkas lama:', e.message);
          }
        }
      }

      // Simpan file baru
      const randomName = `doc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      savedFileName = path.basename(fileName);
      savedFilePath = randomName;

      const targetPath = path.join(uploadDir, randomName);
      if (!targetPath.startsWith(uploadDir + path.sep)) {
        return res.status(400).json({
          status: 'error',
          message: 'Penyimpanan file tidak valid.'
        });
      }

      const buffer = Buffer.from(fileData, 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({
          status: 'error',
          message: 'Ukuran berkas melebihi batas maksimal 5MB.'
        });
      }

      fs.writeFileSync(targetPath, buffer);
    }

    const docStatus = status || doc.status;
    const berlakuDiStr = Array.isArray(berlaku_di) ? JSON.stringify(berlaku_di) : berlaku_di;
    const jabatanTerkaitStr = Array.isArray(jabatan_terkait) ? JSON.stringify(jabatan_terkait) : jabatan_terkait;

    await dbQuery.run(
      "UPDATE documentations SET judul = ?, isi = ?, file_name = ?, file_path = ?, status = ?, berlaku_di = ?, jabatan_terkait = ? WHERE id = ?",
      [judul.trim(), isi.trim(), savedFileName, savedFilePath, docStatus, berlakuDiStr, jabatanTerkaitStr, id]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Dokumentasi berhasil diperbarui.'
    });
  } catch (error) {
    console.error('updateDocumentation error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui dokumentasi.'
    });
  }
}

/**
 * Menghapus dokumentasi beserta berkas terkait di penyimpanan
 */
export async function deleteDocumentation(req, res) {
  const { id } = req.params;

  try {
    const doc = await dbQuery.get("SELECT * FROM documentations WHERE id = ?", [id]);
    if (!doc) {
      return res.status(404).json({
        status: 'error',
        message: 'Dokumentasi tidak ditemukan.'
      });
    }

    // Hapus file fisik di uploads
    if (doc.file_path) {
      const filePath = path.join(uploadDir, path.basename(doc.file_path));
      if (fs.existsSync(filePath) && filePath.startsWith(uploadDir + path.sep)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Gagal menghapus file fisik:', e.message);
        }
      }
    }

    await dbQuery.run("DELETE FROM documentations WHERE id = ?", [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Dokumentasi berhasil dihapus.'
    });
  } catch (error) {
    console.error('deleteDocumentation error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus dokumentasi.'
    });
  }
}

/**
 * Toggle status dokumentasi (aktif / tidak aktif)
 */
export async function toggleDocumentationStatus(req, res) {
  const { id } = req.params;

  try {
    const doc = await dbQuery.get("SELECT * FROM documentations WHERE id = ?", [id]);
    if (!doc) {
      return res.status(404).json({
        status: 'error',
        message: 'Dokumentasi tidak ditemukan.'
      });
    }

    const nextStatus = doc.status === 'aktif' ? 'tidak aktif' : 'aktif';

    await dbQuery.run(
      "UPDATE documentations SET status = ? WHERE id = ?",
      [nextStatus, id]
    );

    return res.status(200).json({
      status: 'success',
      message: `Dokumentasi berhasil diubah menjadi ${nextStatus}.`,
      data: { status: nextStatus }
    });
  } catch (error) {
    console.error('toggleStatus error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal merubah status dokumentasi.'
    });
  }
}

/**
 * Menyajikan/mengunduh file mentah secara aman
 */
export async function serveDocumentationFile(req, res) {
  const { filename } = req.params;

  try {
    // Sanitasi nama file demi keamanan
    const safeName = path.basename(filename);
    const filePath = path.join(uploadDir, safeName);

    // Proteksi Directory Traversal & periksa keberadaan file
    if (!filePath.startsWith(uploadDir + path.sep) || !fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'error',
        message: 'Berkas tidak ditemukan.'
      });
    }

    const ext = path.extname(safeName).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.xls') contentType = 'application/vnd.ms-excel';
    else if (ext === '.xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);

    // Stream file ke klien
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error('serveFile error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengunduh berkas.'
    });
  }
}

/**
 * Parsing berkas Excel/PDF dan merender HTML preview ramah layar seluler
 */
export async function previewDocumentation(req, res) {
  const { id } = req.params;

  try {
    const doc = await dbQuery.get("SELECT * FROM documentations WHERE id = ?", [id]);
    if (!doc) {
      return res.send(`<html><body style="font-family:sans-serif;padding:20px;color:#ff3b30;"><h3>Error: Dokumentasi tidak ditemukan</h3></body></html>`);
    }

    if (!doc.file_path) {
      // Jika tidak ada berkas terunggah, cukup tampilkan isi rangkuman di halaman responsif
      return res.send(buildMobileHtml(doc.judul, doc.tanggal_publish, doc.isi, `<div style="padding:16px;background:rgba(255,255,255,0.05);border-radius:10px;font-style:italic;color:#94a3b8;">Tidak ada lampiran dokumen untuk arsip ini.</div>`));
    }

    const safeName = path.basename(doc.file_path);
    const filePath = path.join(uploadDir, safeName);

    if (!filePath.startsWith(uploadDir + path.sep) || !fs.existsSync(filePath)) {
      // Fallback jika file fisik tidak ada di uploads
      return res.send(buildMobileHtml(doc.judul, doc.tanggal_publish, doc.isi, `<div style="padding:16px;background:rgba(255,255,255,0.05);border-radius:10px;color:#f59e0b;">Dokumen fisik lampiran tidak ditemukan di server.</div>`));
    }

    const ext = path.extname(safeName).toLowerCase();
    let bodyContentHtml = '';

    if (ext === '.xlsx' || ext === '.xls') {
      try {
        const workbook = XLSX.readFile(filePath);
        
        let tabsHtml = '<div class="tabs-container">';
        let sheetsContentHtml = '<div class="sheets-container">';

        workbook.SheetNames.forEach((sheetName, index) => {
          const sheet = workbook.Sheets[sheetName];
          // Gunakan built-in sheet_to_html dari xlsx
          const rawHtml = XLSX.utils.sheet_to_html(sheet);

          // Hias HTML agar bersih dan responsif
          const cleanedHtml = rawHtml
            .replace('<table', '<table class="excel-table"')
            .replace(/border="1"/g, '');

          const isActive = index === 0 ? 'active' : '';
          
          tabsHtml += `<button class="tab-button ${isActive}" onclick="openSheet(event, 'sheet-${index}')">${sheetName}</button>`;
          sheetsContentHtml += `<div id="sheet-${index}" class="sheet-content ${isActive}">${cleanedHtml}</div>`;
        });

        tabsHtml += '</div>';
        sheetsContentHtml += '</div>';

        bodyContentHtml = `
          <div class="excel-preview-container">
            ${tabsHtml}
            ${sheetsContentHtml}
          </div>
        `;
      } catch (err) {
        console.error('XLSX parsing error:', err.message);
        bodyContentHtml = `<div style="padding:16px;background:rgba(255,255,255,0.05);border-radius:10px;color:#f87171;">Gagal mem-parsing berkas Excel. Detail: ${err.message}</div>`;
      }
    } else if (ext === '.pdf') {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await PDFParse(dataBuffer);
        
        // Bersihkan teks PDF dan ganti newlines dengan paragraf / break line HTML
        const cleanText = data.text
          .trim()
          .replace(/\n\s*\n/g, '</p><p>')
          .replace(/\n/g, '<br>');

        bodyContentHtml = `
          <div class="pdf-preview-container">
            <h4>Isi Teks Dokumen (PDF):</h4>
            <div class="pdf-text-box">
              <p>${cleanText || 'Tidak ada teks yang dapat diekstrak dari PDF.'}</p>
            </div>
          </div>
        `;
      } catch (err) {
        console.error('PDF parsing error:', err.message);
        bodyContentHtml = `<div style="padding:16px;background:rgba(255,255,255,0.05);border-radius:10px;color:#f87171;">Gagal mem-parsing berkas PDF. Detail: ${err.message}</div>`;
      }
    } else {
      bodyContentHtml = `<div style="padding:16px;background:rgba(255,255,255,0.05);border-radius:10px;">Format berkas tidak didukung untuk pratinjau mobile.</div>`;
    }

    return res.send(buildMobileHtml(doc.judul, doc.tanggal_publish, doc.isi, bodyContentHtml));
  } catch (error) {
    console.error('previewDocumentation error:', error.message);
    return res.send(`<html><body style="font-family:sans-serif;padding:20px;color:#ff3b30;background:#0f121e;"><h3>Gagal memuat pratinjau dokumen.</h3></body></html>`);
  }
}

/**
 * Kerangka template HTML responsif bernuansa gelap premium ramah layar seluler
 */
function buildMobileHtml(judul, tanggal, rangkuman, contentHtml) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${judul} - Pratinjau Karyawan</title>
      <style>
        :root {
          --bg-main: #0F121E;
          --bg-card: #1B1E30;
          --primary: #6366F1;
          --text: #F8FAFC;
          --text-muted: #94A3B8;
          --border: rgba(255, 255, 255, 0.06);
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background-color: var(--bg-main);
          color: var(--text);
          line-height: 1.6;
          padding: 16px;
        }
        .header {
          margin-bottom: 20px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 12px;
        }
        .title {
          font-size: 1.3rem;
          font-weight: 700;
          color: #FFF;
          margin-bottom: 4px;
        }
        .meta {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
        }
        .summary-box {
          background-color: var(--bg-card);
          padding: 14px;
          border-radius: 12px;
          border: 1px solid var(--border);
          margin-bottom: 20px;
        }
        .summary-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--primary);
          text-transform: uppercase;
          margin-bottom: 4px;
          letter-spacing: 0.5px;
        }
        .summary-text {
          font-size: 0.9rem;
          color: #E2E8F0;
        }
        .content-box {
          background-color: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          overflow: hidden;
        }
        .excel-preview-container {
          width: 100%;
        }
        .tabs-container {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          margin-bottom: 12px;
          padding-bottom: 4px;
          scrollbar-width: thin;
        }
        .tab-button {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-muted);
          border: 1px solid var(--border);
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .tab-button.active {
          background: var(--primary);
          color: #FFF;
          border-color: var(--primary);
        }
        .sheet-content {
          display: none;
          width: 100%;
          overflow-x: auto;
        }
        .sheet-content.active {
          display: block;
        }
        .excel-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.75rem;
          color: #E2E8F0;
        }
        .excel-table td, .excel-table th {
          border: 1px solid var(--border);
          padding: 6px 8px;
          white-space: nowrap;
        }
        .excel-table tr:nth-child(even) {
          background: rgba(255, 255, 255, 0.02);
        }
        .pdf-preview-container h4 {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .pdf-text-box {
          font-size: 0.85rem;
          color: #E2E8F0;
          white-space: pre-wrap;
          line-height: 1.7;
          background: rgba(0, 0, 0, 0.15);
          padding: 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          max-height: 400px;
          overflow-y: auto;
        }
      </style>
      <script>
        function openSheet(evt, sheetId) {
          var i, tabcontent, tablinks;
          tabcontent = document.getElementsByClassName("sheet-content");
          for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
            tabcontent[i].classList.remove("active");
          }
          tablinks = document.getElementsByClassName("tab-button");
          for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
          }
          document.getElementById(sheetId).style.display = "block";
          document.getElementById(sheetId).classList.add("active");
          evt.currentTarget.className += " active";
        }
      </script>
    </head>
    <body>
      <div class="header">
        <h1 class="title">${judul}</h1>
        <div class="meta">Dipublikasikan: ${tanggal}</div>
      </div>

      <div class="summary-box">
        <h3 class="summary-title">Rangkuman Ringkas</h3>
        <p class="summary-text">${rangkuman}</p>
      </div>

      <div class="content-box">
        ${contentHtml}
      </div>
    </body>
    </html>
  `;
}

export async function sendDocumentation(req, res) {
  const { id } = req.params;
  try {
    const result = await dbQuery.run("UPDATE documentations SET status_kirim = 1 WHERE id = ?", [id]);
    if (result.changes === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Dokumentasi tidak ditemukan.'
      });
    }
    return res.status(200).json({
      status: 'success',
      message: 'Dokumentasi berhasil dikirim ke mobile karyawan.'
    });
  } catch (error) {
    console.error('sendDocumentation error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengirim dokumentasi.'
    });
  }
}
