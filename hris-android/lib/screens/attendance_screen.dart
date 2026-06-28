import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import '../providers/auth_provider.dart';
import '../models/models.dart';
import '../config/api_client.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({Key? key}) : super(key: key);

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  double _latitude = -6.2088;
  double _longitude = 106.8456;
  String _locationSource = 'Kantor Sudirman (Simulasi)';
  final _notesController = TextEditingController();
  int _activeTab = 0; // 0 = Absensi GPS, 1 = Rekapan Istirahat
  bool _isLoadingAbsen = false;

  Future<bool> _handleLocationPermission() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Layanan lokasi dinonaktifkan. Silakan aktifkan GPS Anda.'),
        backgroundColor: Colors.red,
      ));
      return false;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Izin lokasi ditolak.'),
          backgroundColor: Colors.red,
        ));
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Izin lokasi ditolak permanen, tidak dapat meminta izin.'),
        backgroundColor: Colors.red,
      ));
      return false;
    }

    return true;
  }

  Future<void> _performAbsensi(AuthProvider auth, bool isClockIn) async {
    final hasPermission = await _handleLocationPermission();
    if (!hasPermission) return;

    setState(() {
      _isLoadingAbsen = true;
    });

    try {
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      final ImagePicker picker = ImagePicker();
      final XFile? image = await picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        maxWidth: 600,
        imageQuality: 70,
      );

      if (image == null) {
        setState(() {
          _isLoadingAbsen = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('❌ Foto selfie wajib diambil untuk absensi.'),
          backgroundColor: Colors.red,
        ));
        return;
      }

      final bytes = await image.readAsBytes();
      final base64Photo = 'data:image/jpeg;base64,${base64Encode(bytes)}';

      if (isClockIn) {
        await auth.clockIn(position.latitude, position.longitude, photoSelfie: base64Photo);
      } else {
        await auth.clockOut(position.latitude, position.longitude, photoSelfie: base64Photo);
      }

      if (auth.attendanceError != null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('❌ ${auth.attendanceError}'),
          backgroundColor: Colors.red,
        ));
      } else if (auth.attendanceSuccess != null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('✅ ${auth.attendanceSuccess}'),
          backgroundColor: Colors.green,
        ));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('❌ Gagal memproses absensi: $e'),
        backgroundColor: Colors.red,
      ));
    } finally {
      setState(() {
        _isLoadingAbsen = false;
      });
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  void _showConfirmDialog(String title, String message, VoidCallback onConfirm) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            title,
            style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
          ),
          content: Text(
            message,
            style: const TextStyle(color: Color(0x8DEEEEEE), fontSize: 14),
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
              child: Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEEEEEE),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () {
                        Navigator.pop(context);
                        onConfirm();
                      },
                      child: const Text('YA', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0x1AEEEEEE)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () {
                        Navigator.pop(context);
                      },
                      child: const Text('BATAL', style: TextStyle(color: Color(0x8DEEEEEE), fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            )
          ],
        );
      },
    );
  }

  int _parseToMinutes(String? timeStr) {
    if (timeStr == null || timeStr.isEmpty) return 0;
    try {
      final parts = timeStr.split(':');
      if (parts.length < 2) return 0;
      final hrs = int.tryParse(parts[0]) ?? 0;
      final mins = int.tryParse(parts[1]) ?? 0;
      return hrs * 60 + mins;
    } catch (_) {
      return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final today = auth.todayAttendance;

    const darkBg = Color(0xFF222831); // Hitam Pekat
    const cardBg = Color(0xFF393E46); // Cokelat Tua
    const violet = Color(0xFFEEEEEE); // Krem (accent)
    const textMuted = Color(0x8DEEEEEE); // Krem muted
    const success = Color(0xFF10B981);
    const warning = Color(0xFFF59E0B);

    return Scaffold(
      backgroundColor: darkBg,
      body: Column(
        children: [
          // Segmented Control
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            padding: const EdgeInsets.all(4.0),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.05)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _activeTab = 0),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: _activeTab == 0 ? violet : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Tabel Kehadiran',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: _activeTab == 0 ? Colors.black : textMuted,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _activeTab = 1),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: _activeTab == 1 ? violet : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Rekapan Istirahat',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: _activeTab == 1 ? Colors.black : textMuted,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _activeTab == 0
                ? _buildAbsensiTab(context, auth, today)
                : _buildRekapanIstirahatTab(context, auth),
          ),
        ],
      ),
    );
  }

  Widget _buildAbsensiTab(
    BuildContext context,
    AuthProvider auth,
    AttendanceRecord? today,
  ) {
    const cardBg = Color(0xFF393E46); // Cokelat Tua
    const violet = Color(0xFFEEEEEE); // Krem (accent)
    const textMuted = Color(0x8DEEEEEE); // Krem muted
    const success = Color(0xFF10B981);
    const warning = Color(0xFFF59E0B);
    const accentColor = Color(0xFF00ADB5);

    final history = auth.attendanceHistory;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Tabel Kehadiran Karyawan',
            style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            'Nama: ${auth.profile?.fullName ?? "-"} | NIK: ${auth.profile?.nik ?? "-"}',
            style: const TextStyle(color: textMuted, fontSize: 13, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 16),
          
          // Clock-In / Clock-Out Control Panel
          Container(
            padding: const EdgeInsets.all(20.0),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFEEEEEE).withOpacity(0.05)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.fingerprint, color: accentColor, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'Absensi Masuk / Pulang',
                      style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (today == null || today.clockIn == null) ...[
                  const Text(
                    'Anda belum melakukan absensi masuk (Clock-In) hari ini.',
                    style: TextStyle(color: textMuted, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: _isLoadingAbsen
                          ? null
                          : () => _performAbsensi(auth, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accentColor,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      icon: _isLoadingAbsen
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Icon(Icons.camera_alt, color: Colors.white),
                      label: Text(
                        _isLoadingAbsen ? 'Memproses...' : 'CLOCK-IN (MASUK KERJA)',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ] else if (today.clockOut == null) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Jam Masuk', style: TextStyle(color: textMuted, fontSize: 11)),
                          const SizedBox(height: 4),
                          Text(
                            today.clockIn!,
                            style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: success.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'Sedang Bekerja',
                          style: TextStyle(color: success, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: _isLoadingAbsen
                          ? null
                          : () => _performAbsensi(auth, false),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: warning,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      icon: _isLoadingAbsen
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Icon(Icons.camera_alt, color: Colors.white),
                      label: Text(
                        _isLoadingAbsen ? 'Memproses...' : 'CLOCK-OUT (PULANG KERJA)',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ] else ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Jam Masuk', style: TextStyle(color: textMuted, fontSize: 11)),
                          const SizedBox(height: 4),
                          Text(
                            today.clockIn!,
                            style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 14, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Jam Keluar', style: TextStyle(color: textMuted, fontSize: 11)),
                          const SizedBox(height: 4),
                          Text(
                            today.clockOut!,
                            style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 14, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: accentColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'Absensi Selesai',
                          style: TextStyle(color: accentColor, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Center(
                    child: Text(
                      '🎉 Anda telah menyelesaikan absensi untuk hari ini.',
                      style: TextStyle(color: success, fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),
          
          if (history.isEmpty)
            Center(
              child: Container(
                padding: const EdgeInsets.all(24.0),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'Tidak ada data kehadiran.',
                  style: TextStyle(color: textMuted, fontSize: 14),
                ),
              ),
            )
          else
            Container(
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.05)),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    headingRowColor: MaterialStateProperty.all(accentColor.withOpacity(0.15)),
                    dataRowColor: MaterialStateProperty.all(cardBg),
                    columnSpacing: 20,
                    horizontalMargin: 12,
                    columns: const [
                      DataColumn(label: Text('Tanggal', style: TextStyle(color: violet, fontWeight: FontWeight.bold, fontSize: 12))),
                      DataColumn(label: Text('Masuk', style: TextStyle(color: violet, fontWeight: FontWeight.bold, fontSize: 12))),
                      DataColumn(label: Text('Mulai Istirahat', style: TextStyle(color: violet, fontWeight: FontWeight.bold, fontSize: 12))),
                      DataColumn(label: Text('Akhir Istirahat', style: TextStyle(color: violet, fontWeight: FontWeight.bold, fontSize: 12))),
                      DataColumn(label: Text('Pulang', style: TextStyle(color: violet, fontWeight: FontWeight.bold, fontSize: 12))),
                      DataColumn(label: Text('Status', style: TextStyle(color: violet, fontWeight: FontWeight.bold, fontSize: 12))),
                      DataColumn(label: Text('Keterangan', style: TextStyle(color: violet, fontWeight: FontWeight.bold, fontSize: 12))),
                    ],
                    rows: history.map((log) {
                      final status = log.statusIn?.toLowerCase() ?? '';
                      Color statusColor = textMuted;
                      if (status.contains('tepat') || status.contains('hadir') || status.contains('valid')) {
                        statusColor = success;
                      } else if (status.contains('telat') || status.contains('terlambat') || status.contains('warning')) {
                        statusColor = warning;
                      } else if (status.contains('mangkir') || status.contains('absent') || status.contains('sakit') || status.contains('izin')) {
                        statusColor = const Color(0xFFEF4444);
                      }

                      return DataRow(
                        cells: [
                          DataCell(Text(log.date, style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 11))),
                          DataCell(Text(log.clockIn ?? '-', style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 11))),
                          DataCell(Text(log.jamMulaiIstirahat ?? '-', style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 11))),
                          DataCell(Text(log.jamAkhirIstirahat ?? '-', style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 11))),
                          DataCell(Text(log.clockOut ?? '-', style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 11))),
                          DataCell(
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: statusColor.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: statusColor.withOpacity(0.5), width: 0.5),
                              ),
                              child: Text(
                                log.statusIn ?? '-',
                                style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                          DataCell(Text(log.notes ?? '-', style: const TextStyle(color: textMuted, fontSize: 11))),
                        ],
                      );
                    }).toList(),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildRekapanIstirahatTab(
    BuildContext context,
    AuthProvider auth,
  ) {
    const darkBg = Color(0xFF222831); // Hitam Pekat
    const cardBg = Color(0xFF393E46); // Cokelat Tua
    const violet = Color(0xFFEEEEEE); // Krem (accent)
    const textMuted = Color(0x8DEEEEEE); // Krem muted
    const success = Color(0xFF10B981);
    const warning = Color(0xFFF59E0B);
    int totalPoints = 0;
    final List<Map<String, dynamic>> breakLogs = [];

    for (var log in auth.attendanceHistory) {
      if (log.jamMulaiIstirahat == null || log.jamAkhirIstirahat == null) continue;

      final startMin = _parseToMinutes(log.jamMulaiIstirahat);
      var endMin = _parseToMinutes(log.jamAkhirIstirahat);
      if (endMin < startMin) {
        endMin += 24 * 60;
      }
      final actualMin = endMin - startMin;

      var standardMin = 180; // Default 3 Jam
      final outletName = (log.outlet ?? auth.profile?.outlet ?? '').toUpperCase();
      if (outletName.contains('ABS') || outletName.contains('SURABAYA')) {
        standardMin = 120; // 2 Jam
      }

      final overage = actualMin - standardMin;
      final points = overage > 0 ? overage : 0;
      totalPoints += points;

      breakLogs.add({
        'date': log.date,
        'jamMulai': log.jamMulaiIstirahat,
        'jamAkhir': log.jamAkhirIstirahat,
        'actualMin': actualMin,
        'standardMin': standardMin,
        'points': points,
        'status': points > 0 ? 'Terlambat' : 'Tepat Waktu',
      });
    }

    final denda = totalPoints > 15 ? (totalPoints - 15) * 1000 : 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Denda Info Box
          Container(
            padding: const EdgeInsets.all(20.0),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: denda > 0 ? const Color(0xFFEF4444).withOpacity(0.35) : violet.withOpacity(0.1),
                width: 1.5,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Rangkuman Denda Istirahat',
                      style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                    Icon(
                      denda > 0 ? Icons.gavel_rounded : Icons.verified_user_rounded,
                      color: denda > 0 ? const Color(0xFFEF4444) : success,
                      size: 20,
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total Poin Terkumpul', style: TextStyle(color: textMuted, fontSize: 12)),
                    Text(
                      '$totalPoints Poin',
                      style: TextStyle(
                        color: totalPoints > 15 ? const Color(0xFFEF4444) : Color(0xFFEEEEEE),
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: const [
                    Text('Batas Toleransi Gratis', style: TextStyle(color: textMuted, fontSize: 12)),
                    Text(
                      '15 Poin',
                      style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: const [
                    Text('Tarif Denda per Menit/Poin', style: TextStyle(color: textMuted, fontSize: 12)),
                    Text(
                      'Rp 1.000',
                      style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const Divider(color: Color(0x1AEEEEEE), height: 24, thickness: 1),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'ESTIMASI DEPRESIASI / DENDA',
                      style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      denda > 0 ? 'Rp ${denda.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]}.')}' : 'Rp 0',
                      style: TextStyle(
                        color: denda > 0 ? const Color(0xFFEF4444) : success,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                if (denda > 0) ...[
                  const SizedBox(height: 10),
                  Text(
                    'Rumus: (Poin - 15) x Rp1.000 = ($totalPoints - 15) x Rp1.000',
                    style: const TextStyle(color: Colors.redAccent, fontSize: 10, fontStyle: FontStyle.italic),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Section Title
          const Text(
            'Detail Riwayat Istirahat',
            style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),

          // Logs List
          if (breakLogs.isEmpty) ...[
            const Center(
              child: Padding(
                padding: EdgeInsets.all(32.0),
                child: Text(
                  'Belum ada riwayat istirahat tercatat.',
                  style: TextStyle(color: textMuted, fontSize: 13),
                ),
              ),
            ),
          ] else if (ApiClient.isTabletEdition) ...[
            // Rombak untuk Tablet - Grid tabel lebar datar tanpa scroll horizontal
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.05)),
              ),
              child: DataTable(
                headingRowColor: MaterialStateProperty.all(const Color(0xFFEEEEEE).withOpacity(0.1)),
                columns: const [
                  DataColumn(label: Text('Tanggal', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold, fontSize: 12))),
                  DataColumn(label: Text('Aktual Istirahat', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold, fontSize: 12))),
                  DataColumn(label: Text('Durasi', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold, fontSize: 12))),
                  DataColumn(label: Text('Batas Jadwal', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold, fontSize: 12))),
                  DataColumn(label: Text('Poin', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold, fontSize: 12))),
                  DataColumn(label: Text('Status', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold, fontSize: 12))),
                ],
                rows: breakLogs.map<DataRow>((log) {
                  final isLate = log['points'] > 0;
                  const success = Color(0xFF10B981);
                  return DataRow(
                    cells: [
                      DataCell(Text(log['date'], style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 12))),
                      DataCell(Text('${log['jamMulai']} - ${log['jamAkhir']}', style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 12))),
                      DataCell(Text('${log['actualMin']} menit', style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 12))),
                      DataCell(Text('${log['standardMin']} menit', style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 12))),
                      DataCell(Text(isLate ? '+${log['points']}' : '0', style: TextStyle(color: isLate ? Colors.redAccent : success, fontSize: 12, fontWeight: FontWeight.bold))),
                      DataCell(
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: isLate ? const Color(0xFFEF4444).withOpacity(0.1) : success.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            isLate ? 'Terlambat' : 'Tepat Waktu',
                            style: TextStyle(
                              color: isLate ? const Color(0xFFEF4444) : success,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
          ] else ...[
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: breakLogs.length,
              itemBuilder: (context, index) {
                final log = breakLogs[index];
                final isLate = log['points'] > 0;

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16.0),
                  decoration: BoxDecoration(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.03)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            log['date'],
                            style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: isLate ? const Color(0xFFEF4444).withOpacity(0.1) : success.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              isLate ? 'Terlambat (+${log['points']} Poin)' : 'Tepat Waktu',
                              style: TextStyle(
                                color: isLate ? const Color(0xFFEF4444) : success,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Aktual Istirahat', style: TextStyle(color: textMuted, fontSize: 10)),
                              const SizedBox(height: 2),
                              Text(
                                '${log['jamMulai']} - ${log['jamAkhir']}',
                                style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Durasi Aktual', style: TextStyle(color: textMuted, fontSize: 10)),
                              const SizedBox(height: 2),
                              Text(
                                '${log['actualMin']} menit',
                                style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Batas Jadwal', style: TextStyle(color: textMuted, fontSize: 10)),
                              const SizedBox(height: 2),
                              Text(
                                '${log['standardMin']} menit',
                                style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
