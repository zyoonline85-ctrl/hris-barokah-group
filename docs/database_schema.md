# Desain Skema Database HRIS

Dokumen ini merancang skema database relasional yang aman dan optimal untuk Sistem HRIS (Web Owner & Android Karyawan). Desain ini menggunakan PostgreSQL/MySQL sebagai acuan model relasionalnya.

---

## Diagram Hubungan Entitas (ERD - Teks)

```text
  [users] 1 ------ 1 [employees]
                       |
                       +-- 1 : N [attendances]
                       |
                       +-- 1 : N [leaves]
                       |
                       +-- 1 : N [payrolls]
```

---

## Kamus Data & Desain Tabel

### 1. Tabel `users`
Menyimpan data akun kredensial untuk login ke sistem (baik Web Owner/Admin maupun Android Karyawan).

| Nama Kolom | Tipe Data | Atribut | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | PK, Auto Increment | ID unik user |
| `email` | VARCHAR(150) | UNIQUE, NOT NULL | Alamat email untuk login |
| `password_hash` | VARCHAR(255) | NOT NULL | Password yang sudah di-hash (bcrypt/Argon2) |
| `role` | VARCHAR(20) | NOT NULL | Hak akses: `'owner'`, `'admin'`, `'employee'` |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Waktu akun dibuat |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Waktu data diupdate |

### 2. Tabel `employees`
Menyimpan profil detail karyawan yang terhubung langsung dengan akun di tabel `users`.

| Nama Kolom | Tipe Data | Atribut | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | PK, Auto Increment | ID unik karyawan |
| `user_id` | UUID / INT | FK (`users.id`), NOT NULL | Relasi ke tabel user |
| `nik` | VARCHAR(50) | UNIQUE, NOT NULL | Nomor Induk Karyawan |
| `full_name` | VARCHAR(100) | NOT NULL | Nama lengkap karyawan |
| `phone` | VARCHAR(20) | | Nomor telepon |
| `address` | TEXT | | Alamat lengkap |
| `position` | VARCHAR(50) | NOT NULL | Jabatan (misal: 'Software Engineer') |
| `department` | VARCHAR(50) | NOT NULL | Divisi/Departemen (misal: 'IT') |
| `basic_salary` | DECIMAL(15, 2) | NOT NULL | Gaji pokok bulanan |
| `status` | VARCHAR(20) | DEFAULT `'active'` | Status karyawan: `'active'`, `'inactive'` |
| `joined_date` | DATE | NOT NULL | Tanggal mulai bekerja |

### 3. Tabel `attendances`
Menyimpan log absensi harian karyawan yang dilakukan via Android (termasuk verifikasi koordinat GPS).

| Nama Kolom | Tipe Data | Atribut | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | PK, Auto Increment | ID unik absensi |
| `employee_id` | UUID / INT | FK (`employees.id`), NOT NULL | Relasi ke karyawan |
| `date` | DATE | NOT NULL | Tanggal hari absensi |
| `clock_in` | TIME | | Waktu absen masuk |
| `clock_out` | TIME | | Waktu absen keluar |
| `lat_in` | DECIMAL(10, 8) | | Koordinat Lintang (Latitude) masuk |
| `lng_in` | DECIMAL(11, 8) | | Koordinat Bujur (Longitude) masuk |
| `lat_out` | DECIMAL(10, 8) | | Koordinat Lintang (Latitude) keluar |
| `lng_out` | DECIMAL(11, 8) | | Koordinat Bujur (Longitude) keluar |
| `status_in` | VARCHAR(20) | | Status masuk: `'ontime'`, `'late'` |
| `photo_in_url` | VARCHAR(255) | | Link foto selfie absen masuk (anti-fraud) |
| `photo_out_url` | VARCHAR(255) | | Link foto selfie absen keluar |
| `notes` | TEXT | | Catatan tambahan (misal: alasan telat) |

### 4. Tabel `leaves`
Menyimpan data pengajuan izin, cuti, atau sakit karyawan beserta bukti dokumennya.

| Nama Kolom | Tipe Data | Atribut | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | PK, Auto Increment | ID unik pengajuan |
| `employee_id` | UUID / INT | FK (`employees.id`), NOT NULL | Relasi ke karyawan |
| `leave_type` | VARCHAR(20) | NOT NULL | Tipe pengajuan: `'cuti'`, `'izin'`, `'sakit'` |
| `start_date` | DATE | NOT NULL | Tanggal mulai cuti/izin |
| `end_date` | DATE | NOT NULL | Tanggal akhir cuti/izin |
| `reason` | TEXT | NOT NULL | Alasan pengajuan |
| `status` | VARCHAR(20) | DEFAULT `'pending'` | Status persetujuan: `'pending'`, `'approved'`, `'rejected'` |
| `attachment_url` | VARCHAR(255) | | Bukti surat sakit/dokumen pendukung |
| `approved_by` | UUID / INT | FK (`users.id`) | ID Owner/Admin yang menyetujui |
| `approval_date` | TIMESTAMP | | Waktu persetujuan/penolakan |

### 5. Tabel `payrolls`
Menyimpan data penggajian bulanan karyawan yang digenerate oleh Owner/Admin di Web.

| Nama Kolom | Tipe Data | Atribut | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | UUID / INT | PK, Auto Increment | ID unik payroll |
| `employee_id` | UUID / INT | FK (`employees.id`), NOT NULL | Relasi ke karyawan |
| `period` | VARCHAR(7) | NOT NULL | Periode penggajian, format: `YYYY-MM` |
| `basic_salary` | DECIMAL(15, 2) | NOT NULL | Gaji pokok (saat periode berjalan) |
| `allowances` | DECIMAL(15, 2) | DEFAULT 0 | Tunjangan tambahan |
| `deductions` | DECIMAL(15, 2) | DEFAULT 0 | Potongan (misal: terlambat/mangkir) |
| `net_salary` | DECIMAL(15, 2) | NOT NULL | Gaji bersih yang diterima (`basic_salary` + `allowances` - `deductions`) |
| `payment_status` | VARCHAR(20) | DEFAULT `'unpaid'` | Status pembayaran: `'unpaid'`, `'paid'` |
| `payment_date` | TIMESTAMP | | Tanggal pembayaran dilakukan |
| `slip_url` | VARCHAR(255) | | Link file slip gaji PDF yang di-generate |

---

## Pertimbangan Keamanan & Performa Database

1.  **Indeks (Indexing)**:
    *   Indeks pada `employees.user_id` untuk mempercepat query profil saat user login.
    *   Indeks komposit pada `attendances(employee_id, date)` karena query absensi harian/bulanan per karyawan akan sangat sering dijalankan.
2.  **Enkripsi Data Kredensial**:
    *   Kolom `password_hash` wajib menggunakan algoritma hash kuat satu arah (bcrypt dengan work factor minimum 10 atau Argon2id).
3.  **Audit Trail**:
    *   Setiap tabel menyertakan pencatatan waktu (`created_at`, `updated_at`) untuk pelacakan audit.
