import 'dart:convert';

// 1. Model Profil Karyawan Lengkap
class FullEmployeeProfile {
  final int id;
  final String email;
  final String role;
  final int? employeeId;
  final String? nik;
  final String fullName;
  final String? position;
  final String? department;
  final double? basicSalary;
  final String? joinedDate;
  final String? outlet;

  FullEmployeeProfile({
    required this.id,
    required this.email,
    required this.role,
    this.employeeId,
    this.nik,
    required this.fullName,
    this.position,
    this.department,
    this.basicSalary,
    this.joinedDate,
    this.outlet,
  });

  factory FullEmployeeProfile.fromJson(Map<String, dynamic> json) {
    return FullEmployeeProfile(
      id: json['id'] as int,
      email: json['email'] as String,
      role: json['role'] as String,
      employeeId: json['employee_id'] as int?,
      nik: json['nik'] as String?,
      fullName: json['full_name'] as String,
      position: json['position'] as String?,
      department: json['department'] as String?,
      basicSalary: json['basic_salary'] != null ? (json['basic_salary'] as num).toDouble() : null,
      joinedDate: json['joined_date'] as String?,
      outlet: json['outlet'] as String?,
    );
  }
}

// 2. Model Absensi
class AttendanceRecord {
  final int id;
  final int employeeId;
  final String date;
  final String? clockIn;
  final String? clockOut;
  final double? latIn;
  final double? lngIn;
  final double? latOut;
  final double? lngOut;
  final String? statusIn;
  final String? photoInUrl;
  final String? photoOutUrl;
  final String? notes;
  final String? jamMulaiIstirahat;
  final String? jamAkhirIstirahat;
  final String? outlet;

  AttendanceRecord({
    required this.id,
    required this.employeeId,
    required this.date,
    this.clockIn,
    this.clockOut,
    this.latIn,
    this.lngIn,
    this.latOut,
    this.lngOut,
    this.statusIn,
    this.photoInUrl,
    this.photoOutUrl,
    this.notes,
    this.jamMulaiIstirahat,
    this.jamAkhirIstirahat,
    this.outlet,
  });

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      id: json['id'] as int,
      employeeId: json['employee_id'] as int,
      date: json['date'] as String,
      clockIn: json['clock_in'] as String?,
      clockOut: json['clock_out'] as String?,
      latIn: json['lat_in'] != null ? (json['lat_in'] as num).toDouble() : null,
      lngIn: json['lng_in'] != null ? (json['lng_in'] as num).toDouble() : null,
      latOut: json['lat_out'] != null ? (json['lat_out'] as num).toDouble() : null,
      lngOut: json['lng_out'] != null ? (json['lng_out'] as num).toDouble() : null,
      statusIn: json['status_in'] as String?,
      photoInUrl: json['photo_in_url'] as String?,
      photoOutUrl: json['photo_out_url'] as String?,
      notes: json['notes'] as String?,
      jamMulaiIstirahat: json['jam_mulai_istirahat'] as String?,
      jamAkhirIstirahat: json['jam_akhir_istirahat'] as String?,
      outlet: json['outlet'] as String?,
    );
  }
}

// 3. Model Cuti & Izin
class LeaveRecord {
  final int id;
  final String leaveType;
  final String startDate;
  final String endDate;
  final String reason;
  final String status;
  final String? attachmentUrl;
  final String? approvedByEmail;
  final String? approvalDate;
  final String? halfDayClockOut;
  final double? cashAdvanceAmount;

  LeaveRecord({
    required this.id,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.reason,
    required this.status,
    this.attachmentUrl,
    this.approvedByEmail,
    this.approvalDate,
    this.halfDayClockOut,
    this.cashAdvanceAmount,
  });

  factory LeaveRecord.fromJson(Map<String, dynamic> json) {
    return LeaveRecord(
      id: json['id'] as int,
      leaveType: json['leave_type'] as String,
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      reason: json['reason'] as String,
      status: json['status'] as String,
      attachmentUrl: json['attachment_url'] as String?,
      approvedByEmail: json['approved_by_email'] as String?,
      approvalDate: json['approval_date'] as String?,
      halfDayClockOut: json['half_day_clock_out'] as String?,
      cashAdvanceAmount: json['cash_advance_amount'] != null ? (json['cash_advance_amount'] as num).toDouble() : null,
    );
  }
}

// 4. Model Penggajian (Payroll) — dari API backend
class PayrollRecord {
  final int id;
  final String period;
  final double basicSalary;
  final double allowances;
  final double deductions;
  final double netSalary;
  final String paymentStatus;
  final String? paymentDate;
  final String? slipUrl;

  PayrollRecord({
    required this.id,
    required this.period,
    required this.basicSalary,
    required this.allowances,
    required this.deductions,
    required this.netSalary,
    required this.paymentStatus,
    this.paymentDate,
    this.slipUrl,
  });

  factory PayrollRecord.fromJson(Map<String, dynamic> json) {
    return PayrollRecord(
      id: json['id'] as int,
      period: json['period'] as String,
      basicSalary: (json['basic_salary'] as num).toDouble(),
      allowances: (json['allowances'] as num).toDouble(),
      deductions: (json['deductions'] as num).toDouble(),
      netSalary: (json['net_salary'] as num).toDouble(),
      paymentStatus: json['payment_status'] as String,
      paymentDate: json['payment_date'] as String?,
      slipUrl: json['slip_url'] as String?,
    );
  }
}

// 4b. Model Slip Gaji Lokal — dikirim dari Web Admin via localStorage
class LocalPayrollSlip {
  final String id;
  final String employeeId;
  final String namaKaryawan;
  final String outlet;
  final String jabatan;
  final String lamaBekerja;
  final int bulan;
  final int tahun;
  // Pendapatan
  final double gajiPokok;
  final double uangMakan;
  final double uangLembur;
  final double tunjanganKeluarga;
  final double tunjanganJabatan;
  final double tunjanganPosisi;
  final double tunjanganTidakAbsen;
  final double tunjanganLamaBekerja;
  final double tunjanganLain;
  final double adjustGaji;
  // Pengeluaran
  final double kasbon;
  final double liburReguler;
  final double sakitRawatInap;
  final double sakitSuratDokter;
  final double masukSetengahHari;
  final double liburTambahan;
  final double potonganKelebihanLibur;
  final double dendaWeekendLiburNasional;
  final double dendaKeterlambatIstirahat;
  // Rekap
  final double totalPendapatan;
  final double totalPengeluaran;
  final double thp;
  final String? sentAt;

  LocalPayrollSlip({
    required this.id,
    required this.employeeId,
    required this.namaKaryawan,
    required this.outlet,
    required this.jabatan,
    required this.lamaBekerja,
    required this.bulan,
    required this.tahun,
    this.gajiPokok = 0,
    this.uangMakan = 0,
    this.uangLembur = 0,
    this.tunjanganKeluarga = 0,
    this.tunjanganJabatan = 0,
    this.tunjanganPosisi = 0,
    this.tunjanganTidakAbsen = 0,
    this.tunjanganLamaBekerja = 0,
    this.tunjanganLain = 0,
    this.adjustGaji = 0,
    this.kasbon = 0,
    this.liburReguler = 0,
    this.sakitRawatInap = 0,
    this.sakitSuratDokter = 0,
    this.masukSetengahHari = 0,
    this.liburTambahan = 0,
    this.potonganKelebihanLibur = 0,
    this.dendaWeekendLiburNasional = 0,
    this.dendaKeterlambatIstirahat = 0,
    required this.totalPendapatan,
    required this.totalPengeluaran,
    required this.thp,
    this.sentAt,
  });

  factory LocalPayrollSlip.fromJson(Map<String, dynamic> json) {
    final inc = (json['income'] as Map<String, dynamic>?) ?? {};
    final ded = (json['deduction'] as Map<String, dynamic>?) ?? {};
    return LocalPayrollSlip(
      id: json['id']?.toString() ?? '',
      employeeId: json['employee_id']?.toString() ?? '',
      namaKaryawan: json['nama_karyawan'] as String? ?? '',
      outlet: json['outlet'] as String? ?? '-',
      jabatan: json['jabatan'] as String? ?? '-',
      lamaBekerja: json['lama_bekerja'] as String? ?? '-',
      bulan: (json['bulan'] as num?)?.toInt() ?? 0,
      tahun: (json['tahun'] as num?)?.toInt() ?? 0,
      gajiPokok: _toDouble(inc['gaji_pokok']),
      uangMakan: _toDouble(inc['uang_makan']),
      uangLembur: _toDouble(inc['uang_lembur']),
      tunjanganKeluarga: _toDouble(inc['tunjangan_keluarga']),
      tunjanganJabatan: _toDouble(inc['tunjangan_jabatan']),
      tunjanganPosisi: _toDouble(inc['tunjangan_posisi']),
      tunjanganTidakAbsen: _toDouble(inc['tunjangan_tidak_absen']),
      tunjanganLamaBekerja: _toDouble(inc['tunjangan_lama_bekerja']),
      tunjanganLain: _toDouble(inc['tunjangan_lain']),
      adjustGaji: _toDouble(inc['adjust_gaji']),
      kasbon: _toDouble(ded['kasbon']),
      liburReguler: _toDouble(ded['libur_reguler']),
      sakitRawatInap: _toDouble(ded['sakit_rawat_inap']),
      sakitSuratDokter: _toDouble(ded['sakit_surat_dokter']),
      masukSetengahHari: _toDouble(ded['masuk_setengah_hari']),
      liburTambahan: _toDouble(ded['libur_tambahan']),
      potonganKelebihanLibur: _toDouble(ded['potongan_kelebihan_libur']),
      dendaWeekendLiburNasional: _toDouble(ded['denda_weekend_libur_nasional']),
      dendaKeterlambatIstirahat: _toDouble(ded['denda_keterlambat_istirahat']),
      totalPendapatan: _toDouble(json['total_pendapatan']),
      totalPengeluaran: _toDouble(json['total_pengeluaran']),
      thp: _toDouble(json['thp']),
      sentAt: json['sent_at'] as String?,
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }
}


// 5. Model SOP (Standard Operating Procedure)
class SopRecord {
  final int id;
  final String? nomor;
  final String judul;
  final List<String> berlakuDi;
  final String? jabatanTerkait;
  final String? isi;
  final String? keteranganValidasi;
  final bool hanyaOutletTerpilih;
  final List<String> sasaranRole;
  final String? tanggalDibuat;

  SopRecord({
    required this.id,
    this.nomor,
    required this.judul,
    required this.berlakuDi,
    this.jabatanTerkait,
    this.isi,
    this.keteranganValidasi,
    required this.hanyaOutletTerpilih,
    required this.sasaranRole,
    this.tanggalDibuat,
  });

  factory SopRecord.fromJson(Map<String, dynamic> json) {
    List<String> listBerlaku = [];
    if (json['berlaku_di'] != null) {
      final val = json['berlaku_di'];
      if (val is List) {
        listBerlaku = val.map((e) => e.toString()).toList();
      } else if (val is String) {
        if (val.startsWith('[') && val.endsWith(']')) {
          try {
            // Decodes stringified JSON e.g. "[\"A\",\"B\"]"
            final List<dynamic> parsed = jsonDecode(val);
            listBerlaku = parsed.map((e) => e.toString()).toList();
          } catch (e) {
            listBerlaku = val.split(',').map((e) => e.trim()).toList();
          }
        } else {
          listBerlaku = val.split(',').map((e) => e.trim()).toList();
        }
      }
    }

    List<String> listSasaran = [];
    if (json['sasaran_role'] != null) {
      final val = json['sasaran_role'];
      if (val is List) {
        listSasaran = val.map((e) => e.toString()).toList();
      } else if (val is String) {
        listSasaran = val.split(',').map((e) => e.trim()).toList();
      }
    }

    return SopRecord(
      id: json['id'] as int,
      nomor: json['nomor'] as String?,
      judul: json['judul'] as String,
      berlakuDi: listBerlaku,
      jabatanTerkait: json['jabatan_terkait'] as String?,
      isi: json['isi'] as String?,
      keteranganValidasi: json['keterangan_validasi'] as String?,
      hanyaOutletTerpilih: json['hanya_outlet_terpilih'] == 1 || json['hanya_outlet_terpilih'] == true,
      sasaranRole: listSasaran,
      tanggalDibuat: json['tanggal_dibuat'] as String?,
    );
  }
}

// 6. Model Informasi & Notifikasi
class InformationRecord {
  final int id;
  final String kategori;
  final String judul;
  final String isiInformasi;
  final bool hanyaOutletTerpilih;
  final String? berlakuDi;
  final String createdAt;
  final bool isRead;
  final String? response;
  final String? readAt;

  InformationRecord({
    required this.id,
    required this.kategori,
    required this.judul,
    required this.isiInformasi,
    required this.hanyaOutletTerpilih,
    this.berlakuDi,
    required this.createdAt,
    required this.isRead,
    this.response,
    this.readAt,
  });

  factory InformationRecord.fromJson(Map<String, dynamic> json) {
    return InformationRecord(
      id: json['id'] as int,
      kategori: json['kategori'] as String? ?? 'Umum',
      judul: json['judul'] as String? ?? '',
      isiInformasi: json['isi_informasi'] as String? ?? '',
      hanyaOutletTerpilih: json['hanya_outlet_terpilih'] == 1 || json['hanya_outlet_terpilih'] == true,
      berlakuDi: json['berlaku_di'] as String?,
      createdAt: json['created_at'] as String? ?? '',
      isRead: json['is_read'] == 1 || json['is_read'] == true,
      response: json['response'] as String?,
      readAt: json['read_at'] as String?,
    );
  }
}

// 7. Model Dokumentasi (PDF/Excel Baru)
class DocumentationRecord {
  final int id;
  final String tanggalPublish;
  final String judul;
  final String isi;
  final String? fileName;
  final String? filePath;
  final String status;

  DocumentationRecord({
    required this.id,
    required this.tanggalPublish,
    required this.judul,
    required this.isi,
    this.fileName,
    this.filePath,
    required this.status,
  });

  factory DocumentationRecord.fromJson(Map<String, dynamic> json) {
    return DocumentationRecord(
      id: json['id'] as int,
      tanggalPublish: json['tanggal_publish'] as String? ?? '',
      judul: json['judul'] as String? ?? '',
      isi: json['isi'] as String? ?? '',
      fileName: json['file_name'] as String?,
      filePath: json['file_path'] as String?,
      status: json['status'] as String? ?? 'aktif',
    );
  }
}

// 8. Model Jadwal Istirahat (BreakSchedule)
class BreakSchedule {
  final int id;
  final int employeeId;
  final String date;
  final int sesi;
  final String jamMulai;
  final String jamSelesai;
  final String? fullName;
  final String? nik;
  final String? outlet;

  BreakSchedule({
    required this.id,
    required this.employeeId,
    required this.date,
    required this.sesi,
    required this.jamMulai,
    required this.jamSelesai,
    this.fullName,
    this.nik,
    this.outlet,
  });

  factory BreakSchedule.fromJson(Map<String, dynamic> json) {
    return BreakSchedule(
      id: json['id'] as int,
      employeeId: json['employee_id'] as int,
      date: json['date'] as String,
      sesi: json['sesi'] as int,
      jamMulai: json['jam_mulai'] as String,
      jamSelesai: json['jam_selesai'] as String,
      fullName: json['full_name'] as String?,
      nik: json['nik'] as String?,
      outlet: json['outlet'] as String?,
    );
  }
}

// 9. Model Sanksi & SP (SanctionRecord)
class SanctionRecord {
  final int id;
  final int employeeId;
  final String tipeSanksi;
  final String bentukKesalahan;
  final String alasan;
  final String tanggalBerlaku;
  final String tanggalBerakhir;
  final String status;
  final String diketahuiOleh;
  final String? tanggalTerbit;
  final String? namaKaryawan;
  final String? nikKaryawan;
  final String? department;
  final String? position;
  final String? outlet;

  SanctionRecord({
    required this.id,
    required this.employeeId,
    required this.tipeSanksi,
    required this.bentukKesalahan,
    required this.alasan,
    required this.tanggalBerlaku,
    required this.tanggalBerakhir,
    required this.status,
    required this.diketahuiOleh,
    this.tanggalTerbit,
    this.namaKaryawan,
    this.nikKaryawan,
    this.department,
    this.position,
    this.outlet,
  });

  factory SanctionRecord.fromJson(Map<String, dynamic> json) {
    return SanctionRecord(
      id: json['id'] as int,
      employeeId: json['employee_id'] as int,
      tipeSanksi: json['tipe_sanksi'] as String? ?? '',
      bentukKesalahan: json['bentuk_kesalahan'] as String? ?? 'Pelanggaran Teknis',
      alasan: json['alasan'] as String? ?? '',
      tanggalBerlaku: json['tanggal_berlaku'] as String? ?? '',
      tanggalBerakhir: json['tanggal_berakhir'] as String? ?? '',
      status: json['status'] as String? ?? 'aktif',
      diketahuiOleh: json['diketahui_oleh'] as String? ?? 'SPV',
      tanggalTerbit: json['tanggal_terbit'] as String?,
      namaKaryawan: json['nama_karyawan'] as String?,
      nikKaryawan: json['nik_karyawan'] as String?,
      department: json['department'] as String?,
      position: json['position'] as String?,
      outlet: json['outlet'] as String?,
    );
  }
}

// 10. Model Notifikasi Mobile (NotificationRecord)
class NotificationRecord {
  final int id;
  final int employeeId;
  final String outlet;
  final String title;
  final String message;
  final String type;
  final bool isRead;
  final String createdAt;

  NotificationRecord({
    required this.id,
    required this.employeeId,
    required this.outlet,
    required this.title,
    required this.message,
    required this.type,
    required this.isRead,
    required this.createdAt,
  });

  factory NotificationRecord.fromJson(Map<String, dynamic> json) {
    return NotificationRecord(
      id: json['id'] as int,
      employeeId: json['employee_id'] as int,
      outlet: json['outlet'] as String? ?? '',
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? '',
      type: json['type'] as String? ?? '',
      isRead: json['is_read'] == 1,
      createdAt: json['created_at'] as String? ?? '',
    );
  }
}

// 11. Model Kontrak Kerja Digital (ContractRecord)
class ContractRecord {
  final int id;
  final String nomorSurat;
  final int employeeId;
  final String jenisKontrak;
  final double gajiPokok;
  final double uangMakan;
  final double uangLembur;
  final double tunjanganLamaBekerja;
  final double tunjanganKeluarga;
  final String tanggalPembuatan;
  final String tanggalSelesai;
  final String statusPersetujuan;
  final String? namaKaryawan;
  final String? nikKaryawan;
  final String? position;
  final String? outlet;
  final String? joinedDate;
  final String? address;

  ContractRecord({
    required this.id,
    required this.nomorSurat,
    required this.employeeId,
    required this.jenisKontrak,
    required this.gajiPokok,
    required this.uangMakan,
    required this.uangLembur,
    required this.tunjanganLamaBekerja,
    required this.tunjanganKeluarga,
    required this.tanggalPembuatan,
    required this.tanggalSelesai,
    required this.statusPersetujuan,
    this.namaKaryawan,
    this.nikKaryawan,
    this.position,
    this.outlet,
    this.joinedDate,
    this.address,
  });

  factory ContractRecord.fromJson(Map<String, dynamic> json) {
    return ContractRecord(
      id: json['id'] as int,
      nomorSurat: json['nomor_surat'] as String? ?? '',
      employeeId: json['employee_id'] as int,
      jenisKontrak: json['jenis_kontrak'] as String? ?? 'Surat Perjanjian Kontrak',
      gajiPokok: (json['gaji_pokok'] as num?)?.toDouble() ?? 0.0,
      uangMakan: (json['uang_makan'] as num?)?.toDouble() ?? 0.0,
      uangLembur: (json['uang_lembur'] as num?)?.toDouble() ?? 0.0,
      tunjanganLamaBekerja: (json['tunjangan_lama_bekerja'] as num?)?.toDouble() ?? 0.0,
      tunjanganKeluarga: (json['tunjangan_keluarga'] as num?)?.toDouble() ?? 0.0,
      tanggalPembuatan: json['tanggal_pembuatan'] as String? ?? '',
      tanggalSelesai: json['tanggal_selesai'] as String? ?? '',
      statusPersetujuan: json['status_persetujuan'] as String? ?? 'BELUM SIGN',
      namaKaryawan: json['nama_karyawan'] as String?,
      nikKaryawan: json['nik_karyawan'] as String?,
      position: json['position'] as String?,
      outlet: json['outlet'] as String?,
      joinedDate: json['joined_date'] as String?,
      address: json['address'] as String?,
    );
  }
}

// 12. Model Soal Kuis (QuizQuestion)
class QuizQuestion {
  final int nomor;
  final String tanya;
  final String opsiA;
  final String opsiB;
  final String opsiC;
  final String opsiD;
  final String kunci;

  QuizQuestion({
    required this.nomor,
    required this.tanya,
    required this.opsiA,
    required this.opsiB,
    required this.opsiC,
    required this.opsiD,
    required this.kunci,
  });

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    return QuizQuestion(
      nomor: json['nomor'] as int? ?? 1,
      tanya: json['tanya'] as String? ?? json['teks'] as String? ?? '',
      opsiA: json['opsi_a'] as String? ?? json['opsiA'] as String? ?? '',
      opsiB: json['opsi_b'] as String? ?? json['opsiB'] as String? ?? '',
      opsiC: json['opsi_c'] as String? ?? json['opsiC'] as String? ?? '',
      opsiD: json['opsi_d'] as String? ?? json['opsiD'] as String? ?? '',
      kunci: json['kunci'] as String? ?? json['kunci_jawaban'] as String? ?? 'A',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'nomor': nomor,
      'tanya': tanya,
      'opsi_a': opsiA,
      'opsi_b': opsiB,
      'opsi_c': opsiC,
      'opsi_d': opsiD,
      'kunci': kunci,
    };
  }
}

// 13. Model Kuis Utama (QuizRecord)
class QuizRecord {
  final int id;
  final String judul;
  final String? deskripsi;
  final double skorKelulusan;
  final String outletTarget;
  final String jabatanTarget;
  final String jenisKuis;
  final int durasiMenit;
  final String? tanggalMulai;
  final String? tanggalAkhir;
  final List<QuizQuestion> soal;
  final int statusKirim;

  QuizRecord({
    required this.id,
    required this.judul,
    this.deskripsi,
    required this.skorKelulusan,
    required this.outletTarget,
    required this.jabatanTarget,
    required this.jenisKuis,
    required this.durasiMenit,
    this.tanggalMulai,
    this.tanggalAkhir,
    required this.soal,
    required this.statusKirim,
  });

  factory QuizRecord.fromJson(Map<String, dynamic> json) {
    List<QuizQuestion> listSoal = [];
    if (json['soal'] != null) {
      final val = json['soal'];
      if (val is List) {
        listSoal = val.map((e) => QuizQuestion.fromJson(e as Map<String, dynamic>)).toList();
      } else if (val is String) {
        try {
          final List<dynamic> parsed = jsonDecode(val);
          listSoal = parsed.map((e) => QuizQuestion.fromJson(e as Map<String, dynamic>)).toList();
        } catch (_) {}
      }
    }

    return QuizRecord(
      id: json['id'] as int,
      judul: json['judul'] as String? ?? '',
      deskripsi: json['deskripsi'] as String?,
      skorKelulusan: (json['skor_kelulusan'] as num?)?.toDouble() ?? 0.0,
      outletTarget: json['outlet_target'] as String? ?? 'Semua Outlet',
      jabatanTarget: json['jabatan_target'] as String? ?? 'Semua Jabatan',
      jenisKuis: json['jenis_kuis'] as String? ?? 'Pilihan Berganda',
      durasiMenit: (json['durasi_menit'] as num?)?.toInt() ?? 10,
      tanggalMulai: json['tanggal_mulai'] as String?,
      tanggalAkhir: json['tanggal_akhir'] as String?,
      soal: listSoal,
      statusKirim: (json['status_kirim'] as num?)?.toInt() ?? 0,
    );
  }
}

// 14. Model Pengerjaan Kuis Karyawan (QuizAttemptRecord)
class QuizAttemptRecord {
  final int id;
  final int employeeId;
  final int quizId;
  final double nilai;
  final String status;
  final String tanggal;
  final String? jawaban;
  final Map<String, int>? rekapMatriks;
  final String? namaKaryawan;
  final String? nikKaryawan;
  final String? outletKaryawan;
  final String? judulKuis;
  final double? skorKelulusan;
  final String? jenisKuis;

  QuizAttemptRecord({
    required this.id,
    required this.employeeId,
    required this.quizId,
    required this.nilai,
    required this.status,
    required this.tanggal,
    this.jawaban,
    this.rekapMatriks,
    this.namaKaryawan,
    this.nikKaryawan,
    this.outletKaryawan,
    this.judulKuis,
    this.skorKelulusan,
    this.jenisKuis,
  });

  factory QuizAttemptRecord.fromJson(Map<String, dynamic> json) {
    Map<String, int>? rekap;
    if (json['rekap_matriks'] != null) {
      final val = json['rekap_matriks'];
      if (val is Map) {
        rekap = val.map((k, v) => MapEntry(k.toString(), (v as num).toInt()));
      } else if (val is String) {
        try {
          final Map<String, dynamic> parsed = jsonDecode(val);
          rekap = parsed.map((k, v) => MapEntry(k, (v as num).toInt()));
        } catch (_) {}
      }
    }

    return QuizAttemptRecord(
      id: json['id'] as int,
      employeeId: json['employee_id'] as int,
      quizId: json['quiz_id'] as int,
      nilai: (json['nilai'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as String? ?? 'selesai',
      tanggal: json['tanggal'] as String? ?? '',
      jawaban: json['jawaban'] as String?,
      rekapMatriks: rekap,
      namaKaryawan: json['nama_karyawan'] as String?,
      nikKaryawan: json['nik_karyawan'] as String?,
      outletKaryawan: json['outlet_karyawan'] as String?,
      judulKuis: json['judul_kuis'] as String?,
      skorKelulusan: (json['skor_kelulusan'] as num?)?.toDouble(),
      jenisKuis: json['jenis_kuis'] as String?,
    );
  }
}




