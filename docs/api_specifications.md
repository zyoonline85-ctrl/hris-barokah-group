# Spesifikasi API HRIS (RESTful API)

Dokumen ini mendefinisikan kontrak komunikasi antara aplikasi Web Portal (Owner/Admin) & Aplikasi Android (Karyawan) dengan Server Backend (`hris-backend`).

---

## Standar Keamanan & Format

*   **Format Data**: JSON (`Content-Type: application/json`)
*   **Autentikasi**: JWT (JSON Web Token) dikirim melalui HTTP Header:
    ```http
    Authorization: Bearer <JWT_TOKEN>
    ```
*   **Protokol**: Wajib menggunakan HTTPS dalam lingkungan produksi.
*   **Kode Status HTTP**:
    *   `200 OK` - Permintaan sukses.
    *   `201 Created` - Data baru berhasil dibuat.
    *   `400 Bad Request` - Input tidak valid / error logika bisnis.
    *   `401 Unauthorized` - Token tidak valid atau tidak disertakan.
    *   `403 Forbidden` - Hak akses (Role) tidak mencukupi.
    *   `404 Not Found` - Resource tidak ditemukan.
    *   `500 Internal Server Error` - Kesalahan di server.

---

## 1. Layanan Autentikasi (`/api/auth`)

### `POST /api/auth/login`
Digunakan oleh Web dan Android untuk masuk ke sistem.

*   **Request Body**:
    ```json
    {
      "email": "karyawan@company.com",
      "password": "SecurePassword123"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Login berhasil",
      "data": {
        "token": "eyJhbGciOiJIUzI1NiIsIn...",
        "user": {
          "id": "usr-8f3b-4a5c",
          "email": "karyawan@company.com",
          "role": "employee"
        }
      }
    }
    ```

---

## 2. Layanan Manajemen Karyawan (`/api/employees`)

### `GET /api/employees`
Mengambil semua data profil karyawan (Khusus Owner/Admin).

*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "data": [
        {
          "id": "emp-101",
          "nik": "NIK2026001",
          "full_name": "Budi Santoso",
          "position": "Software Engineer",
          "department": "IT Division",
          "status": "active"
        }
      ]
    }
    ```

### `POST /api/employees`
Menambahkan data karyawan baru beserta pembuatan akun loginnya (Khusus Owner/Admin).

*   **Request Body**:
    ```json
    {
      "email": "karyawan.baru@company.com",
      "password": "TemporaryPassword123",
      "nik": "NIK2026002",
      "full_name": "Rina Wijaya",
      "position": "UI/UX Designer",
      "department": "Product",
      "basic_salary": 8500000.00,
      "joined_date": "2026-06-01"
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "status": "success",
      "message": "Karyawan baru berhasil ditambahkan",
      "data": {
        "employee_id": "emp-102",
        "user_id": "usr-8f3b-4a5d"
      }
    }
    ```

---

## 3. Layanan Absensi (`/api/attendance`)

### `POST /api/attendance/clock-in`
Melakukan absensi masuk (Karyawan via Android).

*   **Request Body**:
    ```json
    {
      "latitude": -6.2088,
      "longitude": 106.8456,
      "photo_selfie": "data:image/jpeg;base64,...(atau URL)"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Clock-In berhasil dicatat",
      "data": {
        "attendance_id": "att-20260529",
        "time": "08:00:15",
        "status": "ontime"
      }
    }
    ```

### `POST /api/attendance/clock-out`
Melakukan absensi keluar (Karyawan via Android).

*   **Request Body**:
    ```json
    {
      "latitude": -6.2090,
      "longitude": 106.8450
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Clock-Out berhasil dicatat",
      "data": {
        "time": "17:00:02"
      }
    }
    ```

---

## 4. Layanan Pengajuan Izin & Cuti (`/api/leaves`)

### `POST /api/leaves`
Mengajukan cuti/izin/sakit baru (Karyawan via Android).

*   **Request Body**:
    ```json
    {
      "leave_type": "sakit",
      "start_date": "2026-06-02",
      "end_date": "2026-06-03",
      "reason": "Sakit demam tinggi, butuh istirahat dokter.",
      "attachment": "data:image/png;base64,...(atau URL surat dokter)"
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "status": "success",
      "message": "Pengajuan izin sakit berhasil dikirim",
      "data": {
        "leave_id": "lv-303",
        "status": "pending"
      }
    }
    ```

### `PUT /api/leaves/:id/approve`
Persetujuan atau penolakan cuti (Owner/Admin via Web).

*   **Request Body**:
    ```json
    {
      "status": "approved" // atau "rejected"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Status pengajuan izin telah diperbarui menjadi approved"
    }
    ```

---

## 5. Layanan Penggajian (`/api/payroll`)

### `POST /api/payroll/generate`
Mengevaluasi dan menghasilkan rekapan gaji bulanan (Khusus Owner/Admin via Web).

*   **Request Body**:
    ```json
    {
      "period": "2026-05"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Payroll untuk periode 2026-05 berhasil di-generate untuk semua karyawan aktif."
    }
    ```
