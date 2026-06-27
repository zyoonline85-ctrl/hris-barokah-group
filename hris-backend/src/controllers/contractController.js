import { dbQuery } from '../config/db.js';

// Helper function to calculate overtime rate per outlet
function getOutletOvertimeRate(outletName, policies) {
  let rate = 7000;
  try {
    const lemburPolicy = policies.find(p => p.nama_aturan && p.nama_aturan.toLowerCase().includes('uang lembur'));
    if (lemburPolicy) {
      let applicable = true;
      if (lemburPolicy.hanya_outlet_terpilih === 1 && lemburPolicy.berlaku_di) {
        const outlets = JSON.parse(lemburPolicy.berlaku_di);
        applicable = outlets.includes(outletName);
      }
      if (applicable && lemburPolicy.deskripsi) {
        const match = lemburPolicy.deskripsi.match(/sebesar\s*rp\s*([\d.]+)/i);
        if (match) {
          rate = parseInt(match[1].replace(/\./g, ''), 10);
        }
      }
    }
  } catch (e) {
    console.error('Error parsing lembur policy:', e);
  }
  return rate;
}

// Helper to calculate length of service allowance
function getTunjanganLamaBekerja(joinedDateStr, policies, outletName) {
  let val = 0;
  try {
    const policy = policies.find(p => p.nama_aturan && p.nama_aturan.toLowerCase().includes('tunjangan lama bekerja'));
    if (policy) {
      let applicable = true;
      if (policy.hanya_outlet_terpilih === 1 && policy.berlaku_di) {
        const outlets = JSON.parse(policy.berlaku_di);
        applicable = outlets.includes(outletName);
      }
      if (applicable && joinedDateStr) {
        const start = new Date(joinedDateStr);
        const now = new Date();
        const yearDiff = now.getFullYear() - start.getFullYear();
        const monthDiff = now.getMonth() - start.getMonth();
        const monthsOfWork = yearDiff * 12 + monthDiff;
        if (monthsOfWork >= 3 && monthsOfWork < 6) val = 100000;
        else if (monthsOfWork >= 6 && monthsOfWork < 12) val = 200000;
        else if (monthsOfWork >= 12) {
          const extraPeriod = Math.floor((monthsOfWork - 12) / 6);
          val = 200000 + (extraPeriod * 50000);
        }
      }
    }
  } catch (e) {
    console.error('Error calculating tunjangan lama bekerja:', e);
  }
  return val;
}

// Helper to calculate family allowance
function getTunjanganKeluarga(joinedDateStr, maritalStatus, policies, outletName) {
  let val = 0;
  try {
    const policy = policies.find(p => p.nama_aturan && p.nama_aturan.toLowerCase().includes('tunjangan keluarga'));
    if (policy) {
      let applicable = true;
      if (policy.hanya_outlet_terpilih === 1 && policy.berlaku_di) {
        const outlets = JSON.parse(policy.berlaku_di);
        applicable = outlets.includes(outletName);
      }
      if (applicable && joinedDateStr) {
        const isMarried = maritalStatus && !/belum/i.test(maritalStatus);
        const start = new Date(joinedDateStr);
        const now = new Date();
        const yearDiff = now.getFullYear() - start.getFullYear();
        const monthDiff = now.getMonth() - start.getMonth();
        const monthsOfWork = yearDiff * 12 + monthDiff;
        if (isMarried && monthsOfWork >= 1) {
          val = 200000;
        }
      }
    }
  } catch (e) {
    console.error('Error calculating tunjangan keluarga:', e);
  }
  return val;
}

export async function getContracts(req, res) {
  try {
    let sql = `
      SELECT c.*, e.full_name as nama_karyawan, e.nik as nik_karyawan, e.position, e.outlet, e.joined_date, e.address
      FROM contracts c
      JOIN employees e ON c.employee_id = e.id
    `;
    const params = [];
    const conditions = [];

    // Filter by role
    if (req.user.role === 'employee') {
      conditions.push("c.employee_id = ?");
      params.push(req.user.employeeId);
    } else if (req.query.employee_id) {
      conditions.push("c.employee_id = ?");
      params.push(req.query.employee_id);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY c.id DESC";

    const contracts = await dbQuery.all(sql, params);
    return res.status(200).json({
      status: 'success',
      data: contracts
    });
  } catch (error) {
    console.error('getContracts error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data kontrak kerja.'
    });
  }
}

export async function createContract(req, res) {
  const { employee_id, jenis_kontrak, gaji_pokok, tanggal_pembuatan, tempat_tanggal_lahir, uang_lembur, keterangan } = req.body;

  const isLainLain = ['Surat Dinas', 'Surat Pemindahan Tugas', 'Surat Perintah'].includes(jenis_kontrak);

  if (!employee_id || !jenis_kontrak || !tanggal_pembuatan || (!isLainLain && gaji_pokok === undefined)) {
    return res.status(400).json({
      status: 'error',
      message: 'ID Karyawan, jenis kontrak/surat, nominal gaji pokok (untuk kontrak), dan tanggal pembuatan wajib diisi.'
    });
  }

  const validTypes = [
    'Surat Pengangkatan', 'Surat Perjanjian Kontrak', 
    'Surat Dinas', 'Surat Pemindahan Tugas', 'Surat Perintah',
    'Surat Magang', 'Kontrak 3 Bulan', 'Kontrak 1 Tahun'
  ];
  if (!validTypes.includes(jenis_kontrak)) {
    return res.status(400).json({
      status: 'error',
      message: 'Jenis kontrak atau surat penugasan tidak valid.'
    });
  }

  try {
    // 1. Fetch employee details
    const emp = await dbQuery.get("SELECT * FROM employees WHERE id = ?", [employee_id]);
    if (!emp) {
      return res.status(404).json({
        status: 'error',
        message: 'Data karyawan tidak ditemukan.'
      });
    }

    // 2. Auto-generate contract number (nomor_surat)
    const dateObj = new Date(tanggal_pembuatan);
    const currentYear = dateObj.getFullYear();
    const currentMonth = dateObj.getMonth() + 1;

    const countRow = await dbQuery.get("SELECT COUNT(*) as count FROM contracts WHERE tanggal_pembuatan LIKE ?", [`${currentYear}%`]);
    const sequence = (countRow ? countRow.count : 0) + 1;
    const numStr = String(sequence).padStart(4, '0');

    const code = (jenis_kontrak === 'Surat Magang') ? 'SPKG' :
                 (jenis_kontrak === 'Kontrak 3 Bulan') ? 'SPSK' :
                 (jenis_kontrak === 'Kontrak 1 Tahun' || jenis_kontrak === 'Surat Pengangkatan' || jenis_kontrak === 'Surat Perjanjian Kontrak') ? 'SPK' : 'SPT';
    const romanMonths = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const romanStr = romanMonths[currentMonth] || 'I';

    const nomorSurat = `${numStr}/HRD/${code}/${romanStr}/${currentYear}`;

    // 3. Finished date
    let tanggalSelesai;
    if (isLainLain) {
      tanggalSelesai = tanggal_pembuatan;
    } else {
      const selesaiDate = new Date(tanggal_pembuatan);
      if (jenis_kontrak === 'Surat Magang') {
        selesaiDate.setMonth(selesaiDate.getMonth() + 1);
      } else if (jenis_kontrak === 'Kontrak 3 Bulan') {
        selesaiDate.setMonth(selesaiDate.getMonth() + 3);
      } else {
        selesaiDate.setFullYear(selesaiDate.getFullYear() + 1);
      }
      tanggalSelesai = selesaiDate.toISOString().split('T')[0];
    }

    // 4. Calculate allowances from policies
    const policies = await dbQuery.all("SELECT * FROM policies WHERE status = 'aktif'");
    
    let gajiPokokVal = 0;
    let uangMakanVal = 0;
    let uangLemburVal = 0;
    let tunjanganLamaBekerjaVal = 0;
    let tunjanganKeluargaVal = 0;

    if (!isLainLain) {
      gajiPokokVal = parseFloat(gaji_pokok) || 0;
      uangMakanVal = 20000;
      uangLemburVal = req.body.hasOwnProperty('uang_lembur') ? parseFloat(uang_lembur) : getOutletOvertimeRate(emp.outlet, policies);
      
      const localMaritalStatus = req.body.marital_status || emp.marital_status || 'Belum menikah';
      const joinedDate = emp.joined_date || tanggal_pembuatan;

      tunjanganLamaBekerjaVal = getTunjanganLamaBekerja(joinedDate, policies, emp.outlet);
      tunjanganKeluargaVal = getTunjanganKeluarga(joinedDate, localMaritalStatus, policies, emp.outlet);
    }

    // 5. Insert into database
    const sql = `
      INSERT INTO contracts (
        nomor_surat, employee_id, jenis_kontrak, gaji_pokok, uang_makan, uang_lembur, 
        tunjangan_lama_bekerja, tunjangan_keluarga, tanggal_pembuatan, tanggal_selesai, status_persetujuan, keterangan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BELUM SIGN', ?)
    `;
    const params = [
      nomorSurat, employee_id, jenis_kontrak, gajiPokokVal, uangMakanVal, uangLemburVal,
      tunjanganLamaBekerjaVal, tunjanganKeluargaVal, tanggal_pembuatan, tanggalSelesai, keterangan || null
    ];

    const result = await dbQuery.run(sql, params);

    // Return the newly created contract record
    const newContract = {
      id: result.id,
      nomor_surat: nomorSurat,
      employee_id,
      jenis_kontrak,
      gaji_pokok: gajiPokokVal,
      uang_makan: uangMakanVal,
      uang_lembur: uangLemburVal,
      tunjangan_lama_bekerja: tunjanganLamaBekerjaVal,
      tunjangan_keluarga: tunjanganKeluargaVal,
      tanggal_pembuatan,
      tanggal_selesai: tanggalSelesai,
      status_persetujuan: 'BELUM SIGN',
      keterangan: keterangan || null
    };

    return res.status(201).json({
      status: 'success',
      data: newContract
    });
  } catch (error) {
    console.error('createContract error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal membuat draf kontrak kerja atau surat penugasan.'
    });
  }
}

export async function signContract(req, res) {
  const { id } = req.params;

  try {
    const contract = await dbQuery.get("SELECT * FROM contracts WHERE id = ?", [id]);
    if (!contract) {
      return res.status(404).json({
        status: 'error',
        message: 'Kontrak kerja tidak ditemukan.'
      });
    }

    // Verify ownership
    if (req.user.role === 'employee' && req.user.employeeId !== contract.employee_id) {
      return res.status(403).json({
        status: 'error',
        message: 'Anda tidak diizinkan menandatangani kontrak milik karyawan lain.'
      });
    }

    await dbQuery.run("UPDATE contracts SET status_persetujuan = 'KONTRAK DITANDATANGANI' WHERE id = ?", [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Kontrak kerja berhasil ditandatangani secara digital.'
    });
  } catch (error) {
    console.error('signContract error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menandatangani kontrak kerja.'
    });
  }
}

export async function getContractPdf(req, res) {
  const { id } = req.params;

  try {
    const contract = await dbQuery.get(`
      SELECT c.*, e.full_name as nama_karyawan, e.nik as nik_karyawan, e.position, e.outlet, e.joined_date, e.address
      FROM contracts c
      JOIN employees e ON c.employee_id = e.id
      WHERE c.id = ?
    `, [id]);

    if (!contract) {
      return res.status(404).send('<h1>Dokumen tidak ditemukan</h1>');
    }

    const isLainLain = ['Surat Dinas', 'Surat Pemindahan Tugas', 'Surat Perintah'].includes(contract.jenis_kontrak);

    let htmlContent = '';

    if (isLainLain) {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${contract.jenis_kontrak} - ${contract.nama_karyawan}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Georgia&family=Inter:wght@400;600;700&display=swap');
            body {
              font-family: 'Georgia', serif;
              color: #000;
              background-color: #fff;
              padding: 3cm 2.5cm;
              margin: 0;
              line-height: 1.6;
              font-size: 14px;
            }
            .header {
              text-align: center;
              margin-bottom: 2rem;
              border-bottom: 2px double #000;
              padding-bottom: 1rem;
            }
            .header h1 {
              font-family: 'Inter', sans-serif;
              font-size: 22px;
              font-weight: 700;
              margin: 0 0 5px 0;
              text-transform: uppercase;
            }
            .header p {
              font-family: 'Inter', sans-serif;
              font-size: 11px;
              color: #555;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .title {
              text-align: center;
              font-size: 16px;
              font-weight: bold;
              text-decoration: underline;
              margin-bottom: 2rem;
              text-transform: uppercase;
              font-family: 'Inter', sans-serif;
            }
            .content-block {
              margin-bottom: 1.5rem;
              text-align: justify;
            }
            .signature-section {
              display: flex;
              justify-content: space-between;
              margin-top: 3.5rem;
              page-break-inside: avoid;
            }
            .signature-box {
              width: 200px;
              text-align: center;
            }
            .signature-space {
              height: 70px;
              margin: 10px 0;
              display: flex;
              align-items: center;
              justify-content: center;
              font-style: italic;
              font-size: 12px;
              color: #333;
            }
            .signed-badge {
              border: 2px solid #2ecc71;
              color: #2ecc71;
              padding: 4px 8px;
              border-radius: 4px;
              font-weight: bold;
              text-transform: uppercase;
              font-family: 'Inter', sans-serif;
              font-size: 10px;
            }
            table {
              width: 100%;
              margin-bottom: 1rem;
            }
            td {
              padding: 5px 0;
              vertical-align: top;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BAROKAH GROUP</h1>
            <p>Management HRD</p>
          </div>

          <div class="title">
            ${contract.jenis_kontrak.toUpperCase()}<br>
            Nomor Surat: ${contract.nomor_surat}
          </div>

          <div class="content-block">
            Yang bertanda tangan di bawah ini:<br>
            <table>
              <tr>
                <td style="width: 25%">Nama</td>
                <td style="width: 2%">:</td>
                <td>Harry Setiawan</td>
              </tr>
              <tr>
                <td>Jabatan</td>
                <td>:</td>
                <td>General Manager</td>
              </tr>
              <tr>
                <td>Alamat</td>
                <td>:</td>
                <td>Jl. Ahmad Yani Tebing Tinggi, Sumatera Utara</td>
              </tr>
              <tr>
                <td colspan="3">Bertindak atas nama <strong>Barokah Group (Management HRD)</strong>, selanjutnya disebut sebagai <strong>PIHAK PERTAMA</strong>.</td>
              </tr>
            </table>
          </div>

          <div class="content-block">
            Dengan ini memberikan penugasan kepada:<br>
            <table>
              <tr>
                <td style="width: 25%">Nama Karyawan</td>
                <td style="width: 2%">:</td>
                <td><strong>${contract.nama_karyawan}</strong></td>
              </tr>
              <tr>
                <td>No KTP / NIK</td>
                <td>:</td>
                <td>${contract.nik_karyawan}</td>
              </tr>
              <tr>
                <td>Outlet Penempatan</td>
                <td>:</td>
                <td>${contract.outlet}</td>
              </tr>
              <tr>
                <td>Status / Jabatan</td>
                <td>:</td>
                <td>${contract.position}</td>
              </tr>
              <tr>
                <td colspan="3">Selanjutnya disebut sebagai <strong>PIHAK KEDUA</strong>.</td>
              </tr>
            </table>
          </div>

          <div class="content-block" style="margin-top: 2rem; border-top: 1px solid #000; padding-top: 1rem;">
            <strong>DETAIL PENUGASAN & KETERANGAN:</strong><br>
            <div style="white-space: pre-wrap; margin-top: 0.5rem; line-height: 1.6;">
              ${contract.keterangan || '-'}
            </div>
          </div>

          <div class="content-block" style="margin-top: 2rem;">
            Surat penugasan ini diterbitkan secara digital pada tanggal ${contract.tanggal_pembuatan} dan berlaku sah sejak tanggal diterbitkan. Kedua belah pihak menyetujui penugasan ini demi kelancaran operasional perusahaan.
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <div><strong>PIHAK PERTAMA</strong></div>
              <div>Barokah Group</div>
              <div class="signature-space">
                <span class="signed-badge">SIGNED DIGITAL</span>
              </div>
              <div style="text-decoration: underline; font-weight: bold;">Harry Setiawan</div>
              <div style="font-size: 11px; color: #555;">General Manager</div>
            </div>
            
            <div class="signature-box">
              <div><strong>PIHAK KEDUA</strong></div>
              <div>Karyawan Bersangkutan</div>
              <div class="signature-space">
                ${contract.status_persetujuan === 'KONTRAK DITANDATANGANI' 
                  ? '<span class="signed-badge" style="border-color: #2ecc71; color: #2ecc71;">SIGNED DIGITAL</span>' 
                  : '<span style="color: #999; font-size: 11px;">[ BELUM DITANDATANGANI ]</span>'
                }
              </div>
              <div style="text-decoration: underline; font-weight: bold;">${contract.nama_karyawan}</div>
              <div style="font-size: 11px; color: #555;">Pihak Kedua</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
        </html>
      `;
    } else {
      const formatCurrency = (val) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
      };

      const formattedGaji = formatCurrency(contract.gaji_pokok);
      const formattedMakan = formatCurrency(contract.uang_makan);
      const formattedLembur = formatCurrency(contract.uang_lembur) + ' per hari';
      const formattedLamaBekerja = formatCurrency(contract.tunjangan_lama_bekerja);
      const formattedKeluarga = formatCurrency(contract.tunjangan_keluarga);

      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>PKWT - ${contract.nama_karyawan}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Georgia&family=Inter:wght@400;600;700&display=swap');
            body {
              font-family: 'Georgia', serif;
              color: #000;
              background-color: #fff;
              padding: 3cm 2.5cm;
              margin: 0;
              line-height: 1.6;
              font-size: 14px;
            }
            .header {
              text-align: center;
              margin-bottom: 2rem;
              border-bottom: 2px double #000;
              padding-bottom: 1rem;
            }
            .header h1 {
              font-family: 'Inter', sans-serif;
              font-size: 20px;
              font-weight: 700;
              margin: 0 0 5px 0;
              text-transform: uppercase;
            }
            .header p {
              font-family: 'Inter', sans-serif;
              font-size: 11px;
              color: #555;
              margin: 0;
              text-transform: uppercase;
            }
            .title {
              text-align: center;
              font-size: 16px;
              font-weight: bold;
              text-decoration: underline;
              margin-bottom: 1.5rem;
              text-transform: uppercase;
              font-family: 'Inter', sans-serif;
            }
            .content-block {
              margin-bottom: 1.5rem;
              text-align: justify;
            }
            .signature-section {
              display: flex;
              justify-content: space-between;
              margin-top: 3rem;
              page-break-inside: avoid;
            }
            .signature-box {
              width: 200px;
              text-align: center;
            }
            .signature-space {
              height: 70px;
              margin: 10px 0;
              display: flex;
              align-items: center;
              justify-content: center;
              font-style: italic;
              font-size: 12px;
              color: #333;
            }
            .signed-badge {
              border: 2px solid #2ecc71;
              color: #2ecc71;
              padding: 4px 8px;
              border-radius: 4px;
              font-weight: bold;
              text-transform: uppercase;
              font-family: 'Inter', sans-serif;
              font-size: 10px;
            }
            table {
              width: 100%;
              margin-bottom: 1rem;
            }
            td {
              padding: 4px 0;
              vertical-align: top;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BAROKAH GROUP</h1>
            <p>Sistem Pengelolaan Surat Penugasan Karyawan Digital</p>
          </div>

          <div class="title">
            PERJANJIAN KERJA WAKTU TERTENTU (PKWT)<br>
            BAROKAH GROUP - ${contract.outlet}<br>
            Nomor Surat: ${contract.nomor_surat}
          </div>

          <div class="content-block">
            Yang bertanda tangan di bawah ini:<br>
            <table>
              <tr>
                <td style="width: 25%">1. Nama</td>
                <td style="width: 2%">:</td>
                <td>Harry Setiawan</td>
              </tr>
              <tr>
                <td>   Jabatan</td>
                <td>:</td>
                <td>General Manager</td>
              </tr>
              <tr>
                <td>   Alamat</td>
                <td>:</td>
                <td>Jl. Ahmad Yani Tebing Tinggi, Sumatera Utara</td>
              </tr>
              <tr>
                <td colspan="3">Dalam hal ini bertindak untuk Pemilik dan atas nama <strong>Barokah Group (Management HRD)</strong> yang selanjutnya disebut sebagai <strong>PIHAK PERTAMA</strong>.</td>
              </tr>
            </table>
          </div>

          <div class="content-block">
            <table>
              <tr>
                <td style="width: 25%">2. Nama Karyawan</td>
                <td style="width: 2%">:</td>
                <td><strong>${contract.nama_karyawan}</strong></td>
              </tr>
              <tr>
                <td>   No KTP / NIK</td>
                <td>:</td>
                <td>${contract.nik_karyawan}</td>
              </tr>
              <tr>
                <td>   Tempat & Tgl Lahir</td>
                <td>:</td>
                <td>${contract.address ? contract.address.split(',')[0] + ', 15 Juli 1997' : 'Tebing Tinggi, 15 Juli 1997'}</td>
              </tr>
              <tr>
                <td>   Status Karyawan</td>
                <td>:</td>
                <td>Karyawan Kontrak</td>
              </tr>
              <tr>
                <td colspan="3">Dalam hal ini bertindak untuk dan atas nama pribadi, yang untuk selanjutnya disebut sebagai <strong>PIHAK KEDUA</strong>.</td>
              </tr>
            </table>
          </div>

          <div class="content-block">
            Pada hari ini, tanggal ${contract.tanggal_pembuatan}, Kedua belah pihak secara sadar mengadakan perjanjian kontrak kerja waktu tertentu (PKWT), dengan isi ketentuan pasal sebagai berikut:
          </div>

          <div class="content-block">
            <strong>Pasal 1: Ketentuan Umum</strong><br>
            1. Dengan ditandatanganinya perjanjian ini, maka Pihak Kedua telah mengetahui, memahami, dan patuh terhadap seluruh peraturan perusahaan serta peraturan-peraturan lain yang diterbitkan oleh Pihak Pertama.<br>
            2. Perjanjian ini dibuat demi kepentingan bersama dalam memenuhi hak dan kewajiban Pihak Pertama sebagai pemberi kerja serta memenuhi hak dan kewajiban Pihak Kedua sebagai karyawan.
          </div>

          <div class="content-block">
            <strong>Pasal 2: Penunjukan Sebagai Karyawan</strong><br>
            1. Pihak Pertama memberikan tanggung jawab penuh kepada Pihak Kedua dengan status sebagai Karyawan.<br>
            2. Pihak Kedua menerima mandat kerja tersebut dengan lokasi penempatan penugasan aktif di: ${contract.outlet}.<br>
            3. Ikatan pekerjaan sebagaimana yang disebutkan pada pasal ini berlaku aktif terhitung sejak tanggal ${contract.tanggal_pembuatan} hingga tanggal berakhir pada ${contract.tanggal_selesai}.
          </div>

          <div class="content-block">
            <strong>Pasal 3: Hak dan Kewajiban Pihak Pertama</strong><br>
            1. Hak Pihak Pertama adalah memastikan Pihak Kedua menjalankan seluruh peraturan operasional perusahaan setelah menandatangani kontrak Perjanjian Kerja Waktu Tertentu ini.<br>
            2. Pihak Pertama berkewajiban melakukan pembayaran jasa kepada Pihak Kedua berupa komponen gaji pokok, tunjangan, dan insentif, di mana pembayaran gaji beserta komponen pelengkapnya dilakukan sesuai penyesuaian pada kondisi-kondisi tertentu.<br>
            3. Pihak Pertama memiliki kewajiban dalam memberikan pelatihan (training) berkala sesuai kapasitas kerja Pihak Kedua dan kebutuhan operasional perusahaan.
          </div>

          <div class="content-block">
            <strong>Pasal 4: Hak dan Kewajiban Pihak Kedua</strong><br>
            1. Hak Pihak Kedua adalah mendapatkan upah jasa berupa Gaji, Tunjangan, dan Insentif bulanan dengan rincian data kebijakan sebagai berikut:<br>
            &nbsp;&nbsp;&nbsp;- Gaji Pokok : ${formattedGaji}<br>
            &nbsp;&nbsp;&nbsp;- Uang Makan : ${formattedMakan} per hari masuk kerja<br>
            &nbsp;&nbsp;&nbsp;- Uang Lembur : ${formattedLembur}<br>
            &nbsp;&nbsp;&nbsp;- Tunjangan Lama Bekerja : ${formattedLamaBekerja}<br>
            &nbsp;&nbsp;&nbsp;- Tunjangan Keluarga : ${formattedKeluarga}<br>
            2. Pihak Kedua berkomitmen penuh, bersedia menerima, dan melaksanakan segala tugas serta tanggung jawab dalam pekerjaan yang diberikan, serta tugas-tugas operasional lain dari Pihak Pertama dengan sebaik-baiknya.<br>
            3. Pihak Kedua wajib melaksanakan pekerjaan sesuai dengan SOP (Standard Operating Procedure), Job Description, serta visi misi kemajuan perusahaan.<br>
            4. Pihak Kedua bersedia menyimpan dan menjaga kerahasiaan baik dokumen, resep, data finansial, maupun informasi internal perusahaan kepada pihak manapun baik secara lisan maupun tertulis tanpa izin resmi. Jika terbukti terjadi pelanggaran kebocoran data, maka Pihak Pertama berhak menerbitkan Surat Peringatan III (SP 3) dan mengenakan denda pinalti tunai senilai Rp 25.000.000,- (Dua Puluh Lima Juta Rupiah).<br>
            5. Pihak Kedua menyatakan bersedia dan patuh untuk ditempatkan di cabang outlet mana saja apabila sewaktu-waktu ditugaskan secara mendesak oleh perusahaan.
          </div>

          <div class="content-block">
            <strong>Pasal 5: Kontrak Berakhir & Sanksi Pinalti Pemutusan</strong><br>
            1. Perjanjian Kerja Waktu Tertentu ini dapat berakhir karena 3 sebab utama: Durasi kontrak habis, pemutusan hubungan kontrak dari Pihak Pertama, atau pemutusan hubungan kontrak atas permintaan Pihak Kedua.<br>
            2. Kontrak Kerja ini memiliki durasi mengikat selama 1 (satu) tahun penuh dan berakhir secara hukum pada tanggal ${contract.tanggal_selesai}.<br>
            3. Pihak Pertama berhak melakukan pemutusan hubungan kontrak sepihak sewaktu-waktu dengan ketentuan:<br>
            &nbsp;&nbsp;&nbsp;a. Pihak Kedua melakukan pelanggaran terhadap peraturan perusahaan setelah sebelumnya berturut-turut diberikan Surat Peringatan I (masa berlaku 6 bulan), Surat Peringatan II (masa berlaku 3 bulan), serta Surat Peringatan III atau pemutusan hubungan kontrak sepihak langsung.<br>
            &nbsp;&nbsp;&nbsp;b. Pihak Kedua melakukan pembocoran rahasia perusahaan berupa dokumen, resep masakan, atau bentuk lainnya secara lisan maupun tulisan tanpa izin tertulis pemilik.<br>
            &nbsp;&nbsp;&nbsp;c. Pihak Kedua melakukan tindak kejahatan kriminalitas dan terbukti secara sah di mata hukum negara maupun hukum agama. Pemutusan kontrak dilakukan seketika setelah Pihak Kedua melakukan ganti rugi senilai kerusakan yang ditimbulkan.<br>
            &nbsp;&nbsp;&nbsp;d. Pihak Pertama mengalami kegagalan produksi, kerugian operasional mendalam, atau kejadian tidak terduga lainnya (Force Majeure) di mana pemilik bisnis menyatakan ketidakmampuan melanjutkan operasional perusahaan.<br>
            4. Pihak Kedua berhak melakukan pemutusan kontrak secara sepihak dengan ketentuan:<br>
            &nbsp;&nbsp;&nbsp;a. Pihak Kedua berkewajiban memberikan surat informasi pengunduran diri minimal 1 (satu) month/bulan sebelum berhenti bekerja (One Month Notice) serta melakukan delegasi serah terima tugas kepada karyawan lain yang ditunjuk.<br>
            &nbsp;&nbsp;&nbsp;b. Pihak Kedua memiliki keterikatan ketat tidak diperbolehkan berhenti bekerja selama 3 (Tiga) Tahun berturut-turut setelah mendapatkan pelatihan/training dalam bentuk apapun yang dibiayai penuh oleh Perusahaan. Jika Pihak Kedua memutuskan hubungan kerja sepihak sebelum masa ikatan dinas habis, maka Pihak Kedua wajib membayar ganti rugi pinalti tunai senilai Rp 25.000.000,- (Dua Puluh Lima Juta Rupiah) kepada Pihak Pertama.<br>
            &nbsp;&nbsp;&nbsp;c. Apabila Pihak Kedua berhenti bekerja baik karena durasi kontrak telah habis, atau akibat pemutusan kontrak baik dengan pemberitahuan maupun tanpa pemberitahuan, maka Pihak Pertama dibebaskan penuh dan tidak memiliki kewajiban melakukan pembayaran uang pesangon, uang penghargaan masa kerja, uang jasa, atau sejenisnya.<br>
            &nbsp;&nbsp;&nbsp;d. Pihak Pertama akan melakukan evaluasi perpanjangan kontrak baru melihat dari catatan performa kinerja harian dan atas persetujuan tertulis dari Pihak Kedua.
          </div>

          <div class="content-block">
            <strong>Pasal 6: Dan Lain - Lain</strong><br>
            1. Surat perjanjian ini bersifat mengikat demi hukum terhadap waktu dan pihak-pihak terkait yang membubuhkan tanda tangan persetujuan digital tanpa adanya unsur paksaan atau tekanan dari pihak manapun.<br>
            2. Perjanjian Kerja Waktu Tertentu ini dapat dilakukan perubahan (<i>Addendum</i>) di kemudian hari sesuai dengan perkembangan kondisi perusahaan dan perundang-undangan yang berlaku.<br>
            3. Jika di kemudian hari terjadi perselisihan penafsiran, maka kedua belah pihak sepakat untuk menyelesaikannya secara musyawarah kekeluargaan. Namun jika tidak dapat diselesaikan secara kekeluargaan, maka Surat Perjanjian Kerja Waktu Tertentu ini menjadi sumber rujukan hukum yang valid dan mutlak di mata hukum positif yang berlaku.
          </div>

          <div class="content-block" style="margin-top: 2rem;">
            Perjanjian ini bersifat digital. Apabila Anda sudah selesai membaca dari awal hingga akhir, dan menekan tombol OK pada sistem aplikasi, maka Anda secara hukum menyatakan menyetujui, tunduk, dan patuh pada seluruh isi kontrak kerja ini secara sadar.
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <div><strong>PIHAK PERTAMA</strong></div>
              <div>Barokah Group (Management HRD)</div>
              <div class="signature-space">
                <span class="signed-badge">SIGNED DIGITAL</span>
              </div>
              <div style="text-decoration: underline; font-weight: bold;">Harry Setiawan</div>
              <div style="font-size: 11px; color: #555;">General Manager</div>
            </div>
            
            <div class="signature-box">
              <div><strong>PIHAK KEDUA</strong></div>
              <div>Karyawan Bersangkutan</div>
              <div class="signature-space">
                ${contract.status_persetujuan === 'KONTRAK DITANDATANGANI' 
                  ? '<span class="signed-badge" style="border-color: #2ecc71; color: #2ecc71;">SIGNED DIGITAL</span>' 
                  : '<span style="color: #999; font-size: 11px;">[ BELUM DITANDATANGANI ]</span>'
                }
              </div>
              <div style="text-decoration: underline; font-weight: bold;">${contract.nama_karyawan}</div>
              <div style="font-size: 11px; color: #555;">Pihak Kedua</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
        </html>
      `;
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(htmlContent);
  } catch (error) {
    console.error('getContractPdf error:', error.message);
    return res.status(500).send('<h1>Terjadi kesalahan internal server</h1>');
  }
}

export async function deleteContract(req, res) {
  const { id } = req.params;
  try {
    const contract = await dbQuery.get("SELECT * FROM contracts WHERE id = ?", [id]);
    if (!contract) {
      return res.status(404).json({
        status: 'error',
        message: 'Kontrak atau surat penugasan tidak ditemukan.'
      });
    }
    await dbQuery.run("DELETE FROM contracts WHERE id = ?", [id]);
    return res.status(200).json({
      status: 'success',
      message: 'Dokumen berhasil dihapus.'
    });
  } catch (error) {
    console.error('deleteContract error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus dokumen.'
    });
  }
}
