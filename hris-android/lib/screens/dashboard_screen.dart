import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../models/models.dart';
import '../config/api_client.dart';
import '../config/prayer_service.dart';
import 'rating_360_screen.dart';
import 'kpi_report_screen.dart';
import 'quiz_list_screen.dart';
import 'disc_screen.dart';
import 'pusat_pengajuan_screen.dart';
import 'payroll_screen.dart';
import 'sop_screen.dart';
import 'attendance_screen.dart';
import 'training_screen.dart';
import 'information_screen.dart';
import 'survey_list_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _dialogShown = false;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      PrayerService.init(auth.profile?.outlet ?? 'Jakarta', (prayerName) {
        _showAdzanAlarmDialog(prayerName);
      });
      
      _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (mounted) setState(() {});
      });
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    PrayerService.dispose();
    super.dispose();
  }

  void _showAdzanAlarmDialog(String prayerName) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: const BorderSide(color: Color(0xFF00ADB5), width: 2),
          ),
          title: const Row(
            children: [
              Icon(Icons.notifications_active, color: Color(0xFF00ADB5)),
              SizedBox(width: 8),
              Text(
                'WAKTU SHOLAT',
                style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: Text(
            'Waktu Sholat $prayerName telah tiba untuk wilayah Anda.\nSelamat menunaikan ibadah sholat.',
            style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, height: 1.5),
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF00ADB5)),
              onPressed: () => Navigator.pop(context),
              child: const Text('OK', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            )
          ],
        );
      },
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_dialogShown) {
      final auth = Provider.of<AuthProvider>(context);
      
      // Check for discipline/sanction notifications first (high priority)
      final unreadDisiplin = auth.unreadNotifications.where((n) => n.type == 'disiplin').toList();
      if (unreadDisiplin.isNotEmpty) {
        _dialogShown = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _showDisciplineWarningDialog(unreadDisiplin.first, auth);
        });
        return;
      }
      
      // Check for leave status notifications next
      if (auth.unacknowledgedLeaveNotifications.isNotEmpty) {
        _dialogShown = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _showLeaveStatusDialog(auth.unacknowledgedLeaveNotifications.first, auth);
        });
        return;
      }

      // Check for quiz notifications next
      final unreadQuiz = auth.unreadNotifications.where((n) => n.type == 'quiz').toList();
      if (unreadQuiz.isNotEmpty) {
        _dialogShown = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _showQuizNotificationDialog(unreadQuiz.first, auth);
        });
        return;
      }

      final unread = auth.informations.where((info) => !info.isRead).toList();
      if (unread.isNotEmpty) {
        _dialogShown = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _showPapanMelayang(unread.first, auth);
        });
      }
    }
  }

  void _showDisciplineWarningDialog(NotificationRecord notif, AuthProvider auth) {
    const glowColor = Color(0xFFEF4444); // Merah tegas
    
    // Trigger heavy vibration multiple times for strong physical warning
    HapticFeedback.vibrate();
    Future.delayed(const Duration(milliseconds: 300), () => HapticFeedback.vibrate());
    Future.delayed(const Duration(milliseconds: 600), () => HapticFeedback.vibrate());
    Future.delayed(const Duration(milliseconds: 900), () => HapticFeedback.vibrate());

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: const BorderSide(color: glowColor, width: 2.5),
          ),
          title: const Row(
            children: [
              Icon(
                Icons.warning_amber_rounded,
                color: glowColor,
                size: 30,
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'PEMBERITAHUAN DISIPLIN',
                  style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          content: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  notif.message,
                  style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, height: 1.5, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Sifat surat sanksi ini mengikat secara hukum internal dan tidak dapat diganggu gugat. Arsip surat lengkap dapat diakses secara permanen pada menu Surat Sanksi di Pusat Informasi.',
                  style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 11, height: 1.4),
                ),
              ],
            ),
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: glowColor,
                shadowColor: glowColor.withOpacity(0.5),
                elevation: 6,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () async {
                Navigator.pop(context);
                await auth.markNotificationAsRead(notif.id);
              },
              child: const Text('Saya Mengerti & Terima', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    ).then((_) {
      setState(() {
        _dialogShown = false;
      });
    });
  }

  void _showLeaveStatusDialog(String message, AuthProvider auth) {
    final isApproved = message.contains('🟢') || message.toLowerCase().contains('setujui');
    final glowColor = isApproved ? const Color(0xFF2ECC71) : const Color(0xFFE74C3C);

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: BorderSide(color: glowColor, width: 2),
          ),
          title: Row(
            children: [
              Icon(
                isApproved ? Icons.check_circle_outline : Icons.error_outline,
                color: glowColor,
                size: 28,
              ),
              const SizedBox(width: 8),
              Text(
                isApproved ? 'Status Cuti: DISETUJUI' : 'Status Cuti: DITOLAK',
                style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              message,
              style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, height: 1.5),
            ),
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: glowColor,
                shadowColor: glowColor.withOpacity(0.5),
                elevation: 6,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () async {
                Navigator.pop(context);
                await auth.acknowledgeLeaveNotifications();
              },
              child: const Text('Saya Mengerti', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    ).then((_) {
      setState(() {
        _dialogShown = false;
      });
    });
  }

  void _showQuizNotificationDialog(NotificationRecord notif, AuthProvider auth) {
    const glowColor = Color(0xFFEEEEEE); // Krem

    // Trigger vibration to alert the user physically
    HapticFeedback.vibrate();
    Future.delayed(const Duration(milliseconds: 300), () => HapticFeedback.vibrate());

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: const BorderSide(color: glowColor, width: 2),
          ),
          title: Row(
            children: [
              Icon(
                Icons.assignment_outlined,
                color: glowColor,
                size: 26,
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'KUIS KOMPETENSI BARU',
                  style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          content: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  notif.title,
                  style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  notif.message,
                  style: const TextStyle(color: Color(0x8DEEEEEE), fontSize: 12, height: 1.4),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Sifat kuis: Wajib diikuti. Klik tombol di bawah untuk langsung membuka daftar kuis kompetensi aktif Anda.',
                  style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 10, height: 1.4),
                ),
              ],
            ),
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
              child: Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: glowColor,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () async {
                        Navigator.pop(context);
                        await auth.markNotificationAsRead(notif.id);
                        if (context.mounted) {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const QuizListScreen()),
                          );
                        }
                      },
                      child: const Text('Buka Kuis', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0x1AEEEEEE)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () async {
                        Navigator.pop(context);
                        await auth.markNotificationAsRead(notif.id);
                      },
                      child: const Text('Tutup', style: TextStyle(color: Color(0x8DEEEEEE), fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            )
          ],
        );
      },
    ).then((_) {
      setState(() {
        _dialogShown = false;
      });
    });
  }

  void _showPapanMelayang(InformationRecord info, AuthProvider auth) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              const Icon(Icons.campaign, color: Color(0xFFEEEEEE), size: 28),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  info.judul,
                  style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          content: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFEEEEEE).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  info.kategori.toUpperCase(),
                  style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 9, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                info.isiInformasi,
                style: const TextStyle(color: Color(0x8DEEEEEE), fontSize: 13, height: 1.5),
              ),
            ],
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEEEEEE),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () {
                Navigator.pop(context);
                _showConfirmReadDialog(info, auth);
              },
              child: const Text('Tutup & Konfirmasi', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    ).then((_) {
      setState(() {
        _dialogShown = false;
      });
    });
  }

  void _showConfirmReadDialog(InformationRecord info, AuthProvider auth) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text(
            'Konfirmasi Membaca',
            style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
          ),
          content: const Text(
            'Apakah kamu sudah membaca dan mengerti?',
            style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 14),
          ),
          actions: [
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEEEEEE),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: () async {
                      await auth.markInformationRead(info.id, 'siap');
                      if (context.mounted) {
                        Navigator.pop(context);
                      }
                    },
                    child: const Text('Siap', style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0x1AEEEEEE)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: () async {
                      await auth.markInformationRead(info.id, 'tanya_admin');
                      if (context.mounted) {
                        Navigator.pop(context);
                      }
                    },
                    child: const Text(
                      'Aku nanya ke admin deh',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final profile = auth.profile;
    final today = auth.todayAttendance;
    final logs = auth.attendanceHistory;

    const darkBg = Color(0xFF222831); // Hitam Pekat
    const cardBg = Color(0xFF393E46); // Cokelat Tua
    const violet = Color(0xFFEEEEEE); // Krem (accent)
    const textMuted = Color(0x8DEEEEEE); // Krem muted
    const success = Color(0xFF10B981);
    const warning = Color(0xFFF59E0B);

    return Scaffold(
      backgroundColor: darkBg,
      body: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [

          // 1. Welcome Card
          Container(
            padding: const EdgeInsets.all(20.0),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.05)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  auth.dailyMotivation,
                  style: const TextStyle(
                    color: Color(0xFFEEEEEE),
                    fontSize: 14,
                    fontStyle: FontStyle.italic,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 12),
                const Divider(color: Color(0x1AEEEEEE), height: 1, thickness: 1),
                const SizedBox(height: 12),
                Text(
                  profile?.fullName ?? 'Karyawan',
                  style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  '${profile?.position ?? '-'} | ${profile?.department ?? '-'}',
                  style: const TextStyle(color: violet, fontSize: 13, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                Text(
                  'NIK: ${profile?.nik ?? '-'}',
                  style: const TextStyle(color: textMuted, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 2. Today Status Card
          Container(
            padding: const EdgeInsets.all(20.0),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.05)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Status Kehadiran Hari Ini',
                  style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 15, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Absen Masuk', style: TextStyle(color: textMuted, fontSize: 11)),
                        const SizedBox(height: 4),
                        Text(
                          today?.clockIn ?? '--:--',
                          style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Absen Keluar', style: TextStyle(color: textMuted, fontSize: 11)),
                        const SizedBox(height: 4),
                        Text(
                          today?.clockOut ?? '--:--',
                          style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Status Masuk', style: TextStyle(color: textMuted, fontSize: 11)),
                        const SizedBox(height: 4),
                        Text(
                          today?.statusIn == 'ontime'
                              ? 'Tepat Waktu'
                              : today?.statusIn == 'late'
                                  ? 'Terlambat'
                                  : 'Belum Absen',
                          style: TextStyle(
                            color: today?.statusIn == 'ontime'
                                ? success
                                : today?.statusIn == 'late'
                                    ? warning
                                    : textMuted,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Adzan Countdown Card
          _buildPrayerCountdownCard(),
          const SizedBox(height: 20),

          // 2a. Break Schedule Card
          _buildBreakScheduleCard(context, auth, today),
          const SizedBox(height: 20),

          // Layanan & Performa (Gojek-Style)
          const Text(
            'Layanan & Performa',
            style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFEEEEEE).withOpacity(0.05)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    Expanded(
                      child: _buildGojekMenuItem(
                        icon: Icons.gps_fixed_outlined,
                        label: 'Kehadiran',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AttendanceScreen())),
                      ),
                    ),
                    Expanded(
                      child: _buildGojekMenuItem(
                        icon: Icons.assignment_outlined,
                        label: 'Kuis',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const QuizListScreen())),
                      ),
                    ),
                    Expanded(
                      child: _buildGojekMenuItem(
                        icon: Icons.book_outlined,
                        label: 'Pelatihan',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TrainingScreen())),
                      ),
                    ),
                    Expanded(
                      child: _buildGojekMenuItem(
                        icon: Icons.analytics_outlined,
                        label: 'KPI',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const KpiReportScreen())),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    Expanded(
                      child: _buildGojekMenuItem(
                        icon: Icons.assignment_outlined,
                        label: 'Pengajuan',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PusatPengajuanScreen())),
                      ),
                    ),
                    Expanded(
                      child: _buildGojekMenuItem(
                        icon: Icons.campaign_outlined,
                        label: 'Informasi',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const InformationScreen(initialIndex: 0))),
                      ),
                    ),
                    Expanded(
                      child: _buildGojekMenuItem(
                        icon: Icons.alarm_on_outlined,
                        label: 'Sholat',
                        onTap: () => _showPrayerScheduleModal(context, auth),
                      ),
                    ),
                    Expanded(
                      child: _buildGojekMenuItem(
                        icon: Icons.poll_outlined,
                        label: 'Survey',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SurveyListScreen())),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // 3. Recent Title
          const Text(
            'Riwayat Kehadiran Terkini',
            style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),

          // Logs List
          if (logs.isEmpty) ...[
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24.0),
                child: Text('Belum ada riwayat absensi.', style: TextStyle(color: textMuted, fontSize: 13)),
              ),
            )
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
                headingRowColor: MaterialStateProperty.all(violet.withOpacity(0.1)),
                columns: const [
                  DataColumn(label: Text('Tanggal', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold, fontSize: 12))),
                  DataColumn(label: Text('Jam Masuk', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold, fontSize: 12))),
                  DataColumn(label: Text('Jam Keluar', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold, fontSize: 12))),
                  DataColumn(label: Text('Status Masuk', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold, fontSize: 12))),
                ],
                rows: logs.take(10).map<DataRow>((log) {
                  final isOnTime = log.statusIn == 'ontime';
                  return DataRow(
                    cells: [
                      DataCell(Text(log.date, style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 12))),
                      DataCell(Text(log.clockIn ?? '--:--', style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 12))),
                      DataCell(Text(log.clockOut ?? '--:--', style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 12))),
                      DataCell(
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: isOnTime ? success.withOpacity(0.1) : warning.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            isOnTime ? 'Tepat Waktu' : 'Terlambat',
                            style: TextStyle(
                              color: isOnTime ? success : warning,
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
            ...logs.take(5).map((log) {
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16.0),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.03)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          log.date,
                          style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Masuk: ${log.clockIn ?? "--"} | Keluar: ${log.clockOut ?? "--"}',
                          style: const TextStyle(color: textMuted, fontSize: 12),
                        ),
                      ],
                    ),
                    Text(
                      log.statusIn == 'ontime' ? 'Tepat Waktu' : 'Terlambat',
                      style: TextStyle(
                        color: log.statusIn == 'ontime' ? success : warning,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              );
            }).toList()
          ]
        ],
      ),
    );
  }

  Widget _buildPrayerCountdownCard() {
    const cardBg = Color(0xFF393E46);
    const textMuted = Color(0x8DEEEEEE);
    const accentColor = Color(0xFF00ADB5);

    return Container(
      padding: const EdgeInsets.all(20.0),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEEEEEE).withOpacity(0.05)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.schedule, color: accentColor, size: 16),
                    SizedBox(width: 6),
                    Text(
                      'Jadwal Sholat Terdekat',
                      style: TextStyle(color: textMuted, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '${PrayerService.nextPrayerName} (${PrayerService.nextPrayerTime} WIB)',
                  style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Text(
                'Mundur',
                style: TextStyle(color: textMuted, fontSize: 10),
              ),
              const SizedBox(height: 4),
              Text(
                PrayerService.timeToNextPrayerStr,
                style: const TextStyle(
                  color: Color(0xFF00ADB5),
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildBreakScheduleCard(BuildContext context, AuthProvider auth, AttendanceRecord? today) {
    const cardBg = Color(0xFF393E46);
    const violet = Color(0xFFEEEEEE);
    const textMuted = Color(0x8DEEEEEE);
    const success = Color(0xFF10B981);
    const warning = Color(0xFFF59E0B);
    
    final sched = auth.todayBreakSchedule;

    return Container(
      padding: const EdgeInsets.all(20.0),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.coffee, color: violet, size: 20),
              SizedBox(width: 8),
              Text(
                'Jadwal Istirahat Anda Hari Ini',
                style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 15, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (sched == null) ...[
            const Text(
              'Belum ada jadwal istirahat ditentukan untuk Anda hari ini.',
              style: TextStyle(color: textMuted, fontSize: 13),
            ),
          ] else ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Sesi Istirahat', style: TextStyle(color: textMuted, fontSize: 11)),
                    const SizedBox(height: 4),
                    Text(
                      'Sesi ${sched.sesi}',
                      style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Waktu Jadwal', style: TextStyle(color: textMuted, fontSize: 11)),
                    const SizedBox(height: 4),
                    Text(
                      '${sched.jamMulai} - ${sched.jamSelesai} WIB',
                      style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (today == null || today.clockIn == null) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.withOpacity(0.3)),
                ),
                child: Row(
                  children: const [
                    Icon(Icons.warning_amber_rounded, color: warning, size: 16),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Silakan Clock-In terlebih dahulu untuk dapat memulai istirahat Anda.',
                        style: TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              // Display actual break timing status
              if (today.jamMulaiIstirahat != null) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Mulai Aktual', style: TextStyle(color: textMuted, fontSize: 11)),
                        const SizedBox(height: 4),
                        Text(
                          today.jamMulaiIstirahat!,
                          style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Selesai Aktual', style: TextStyle(color: textMuted, fontSize: 11)),
                        const SizedBox(height: 4),
                        Text(
                          today.jamAkhirIstirahat ?? '--:--',
                          style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Status Break', style: TextStyle(color: textMuted, fontSize: 11)),
                        const SizedBox(height: 4),
                        Text(
                          today.jamAkhirIstirahat != null ? 'Selesai' : 'Sedang Istirahat',
                          style: TextStyle(
                            color: today.jamAkhirIstirahat != null ? success : warning,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),
              ],

              // Show quick action buttons
              if (today.jamMulaiIstirahat == null) ...[
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton.icon(
                    onPressed: auth.isLoading
                        ? null
                        : () => _showConfirmBreakAction(
                              context,
                              'Mulai Istirahat',
                              'Apakah Anda yakin ingin memulai istirahat sekarang?',
                              () => auth.startBreak(),
                            ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: success,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: const Icon(Icons.play_arrow, color: Color(0xFFEEEEEE)),
                    label: const Text('Mulai Istirahat', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold)),
                  ),
                ),
              ] else if (today.jamAkhirIstirahat == null) ...[
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton.icon(
                    onPressed: auth.isLoading
                        ? null
                        : () => _showConfirmBreakAction(
                              context,
                              'Selesai Istirahat',
                              'Apakah Anda yakin ingin menyelesaikan istirahat sekarang?',
                              () => auth.endBreak(),
                            ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: warning,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: const Icon(Icons.stop, color: Color(0xFFEEEEEE)),
                    label: const Text('Selesai Istirahat', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold)),
                  ),
                ),
              ] else ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: Color(0xFFEEEEEE).withOpacity(0.03),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Center(
                    child: Text(
                      '🎉 Anda telah menyelesaikan istirahat hari ini.',
                      style: TextStyle(color: success, fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ],
          ],
          // Success/Error banners
          if (auth.attendanceSuccess != null) ...[
            const SizedBox(height: 12),
            Center(
              child: Text(
                auth.attendanceSuccess!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: success, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ],
          if (auth.attendanceError != null) ...[
            const SizedBox(height: 12),
            Center(
              child: Text(
                auth.attendanceError!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMenuCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    const cardBg = Color(0xFF393E46);
    const violet = Color(0xFFEEEEEE);
    const textMuted = Color(0x8DEEEEEE);

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFEEEEEE).withOpacity(0.05)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: violet, size: 28),
            const SizedBox(height: 8),
            Text(
              title,
              style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 12, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(color: textMuted, fontSize: 9),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  void _showConfirmBreakAction(BuildContext context, String title, String message, VoidCallback onConfirm) {
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

  Widget _buildGojekMenuItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: const Color(0xFF00ADB5),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF00ADB5).withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(icon, color: Colors.white, size: 26),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFFEEEEEE),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  void _showPrayerScheduleModal(BuildContext context, AuthProvider auth) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF222831),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        final timings = PrayerService.timings ?? {};
        final city = PrayerService.currentCity ?? 'Jakarta';
        final nextPrayer = PrayerService.nextPrayerName;

        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEEEEE).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Jadwal Sholat',
                            style: TextStyle(
                              color: Color(0xFFEEEEEE),
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Wilayah $city & Sekitarnya',
                            style: const TextStyle(
                              color: Color(0x8DEEEEEE),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF00ADB5).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFF00ADB5).withOpacity(0.3)),
                        ),
                        child: Row(
                          children: const [
                            Icon(Icons.gps_fixed, color: Color(0xFF00ADB5), size: 14),
                            SizedBox(width: 4),
                            Text(
                              'Auto GPS',
                              style: TextStyle(
                                color: Color(0xFF00ADB5),
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  if (timings.isEmpty)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: 30),
                        child: Text(
                          'Mengambil data jadwal sholat...',
                          style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 13),
                        ),
                      ),
                    )
                  else
                    ...timings.entries.map((entry) {
                      final name = entry.key;
                      final time = entry.value;
                      final isNext = name.toLowerCase() == nextPrayer.toLowerCase();

                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          color: isNext
                              ? const Color(0xFF00ADB5).withOpacity(0.12)
                              : const Color(0xFF393E46),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isNext
                                ? const Color(0xFF00ADB5).withOpacity(0.4)
                                : const Color(0xFFEEEEEE).withOpacity(0.03),
                            width: 1.5,
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  isNext ? Icons.notifications_active : Icons.notifications_none,
                                  color: isNext ? const Color(0xFF00ADB5) : const Color(0x8DEEEEEE),
                                  size: 20,
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  name,
                                  style: TextStyle(
                                    color: const Color(0xFFEEEEEE),
                                    fontSize: 14,
                                    fontWeight: isNext ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                              ],
                            ),
                            Row(
                              children: [
                                Text(
                                  time,
                                  style: TextStyle(
                                    color: isNext ? const Color(0xFF00ADB5) : const Color(0xFFEEEEEE),
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'WIB',
                                  style: TextStyle(
                                    color: Color(0x8DEEEEEE),
                                    fontSize: 10,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  const SizedBox(height: 12),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
