# Sistem HRIS (Human Resource Information System)

Sistem manajemen sumber daya manusia terintegrasi yang terdiri dari platform Web untuk Owner/HR Admin dan Aplikasi Android untuk Karyawan.

## Struktur Proyek

Proyek ini menggunakan struktur monorepo untuk mengorganisir berbagai komponen sistem:

```text
hris-sistem/
├── hris-web/          # Platform Web Owner (Dashboard & Management)
├── hris-android/      # Aplikasi Android Karyawan (Absensi, Izin, Slip Gaji)
├── hris-backend/      # RESTful API Server & Database
├── docs/              # Dokumentasi teknis, skema DB, & spesifikasi API
└── README.md          # Dokumentasi utama proyek
```

## Komponen Sistem

### 1. HRIS Web Portal (`hris-web/`)
*   **Target Pengguna**: Owner & HR Administrator.
*   **Fungsi Utama**:
    *   Dashboard analitik karyawan & kehadiran real-time.
    *   Manajemen data karyawan (CRUD, Jabatan, Gaji).
    *   Manajemen pengajuan izin, cuti, dan lembur.
    *   Pemrosesan penggajian (payroll) dan slip gaji bulanan.

### 2. HRIS Android App (`hris-android/`)
*   **Target Pengguna**: Karyawan.
*   **Fungsi Utama**:
    *   Absensi harian (Clock-In & Clock-Out) berbasis lokasi GPS (Geofencing).
    *   Pengajuan izin/cuti/sakit secara online beserta upload dokumen pendukung.
    *   Melihat riwayat kehadiran dan status pengajuan izin.
    *   Melihat dan mendownload slip gaji bulanan.

### 3. HRIS Backend Service (`hris-backend/`)
*   **Fungsi Utama**:
    *   Pusat layanan data & komunikasi data untuk Web dan Android.
    *   Keamanan data (autentikasi JWT, enkripsi password, validasi role/RBAC).
    *   Penyimpanan data absensi, data karyawan, dan dokumen terkait.

---

*Catatan: Struktur ini disiapkan sebagai fondasi proyek. Silakan lihat rencana kerja lengkap di `implementation_plan.md`.*
