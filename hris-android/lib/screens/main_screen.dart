import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../config/api_client.dart';
import 'dashboard_screen.dart';
import 'attendance_screen.dart';
import 'training_screen.dart';
import 'information_screen.dart';
import 'profile_screen.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({Key? key}) : super(key: key);

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;
  Timer? _retryTimer;

  final List<Widget> _screens = const [
    DashboardScreen(),
    AttendanceScreen(),
    TrainingScreen(),
    InformationScreen(),
    ProfileScreen(),
  ];

  final List<String> _titles = const [
    'BERANDA UTAMA',
    'ABSENSI GPS GEOFENCE',
    'MATERI & MODUL TRAINING',
    'PAPAN INFORMASI & LOG',
    'PROFIL SAYA',
  ];

  @override
  void dispose() {
    _retryTimer?.cancel();
    super.dispose();
  }

  void _startAutoRetry(AuthProvider auth) {
    _retryTimer?.cancel();
    _retryTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (auth.connectionError && !auth.isLoading) {
        auth.fetchInitialData();
      } else {
        _retryTimer?.cancel();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    const darkBg = Color(0xFF222831); // Hitam Pekat
    const cardBg = Color(0xFF393E46); // Cokelat Tua
    const violet = Color(0xFFEEEEEE); // Krem (accent)
    const textMuted = Color(0x8DEEEEEE); // Krem muted

    // Jika koneksi error, mulai auto-retry agar layar hilang sendiri saat internet kembali
    if (auth.connectionError) {
      _startAutoRetry(auth);
    } else {
      _retryTimer?.cancel();
    }

    return Scaffold(
      backgroundColor: darkBg,
      appBar: AppBar(
        backgroundColor: darkBg,
        elevation: 0,
        centerTitle: true,
        title: Text(
          _titles[_currentIndex],
          style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1),
        ),
        actions: [
          IconButton(
            icon: Stack(
              children: [
                const Icon(Icons.notifications_outlined, color: Color(0xFFEEEEEE)),
                if (auth.informations.any((info) => !info.isRead) || auth.unacknowledgedLeaveNotifications.isNotEmpty)
                  Positioned(
                    right: 0,
                    top: 0,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 8,
                        minHeight: 8,
                      ),
                    ),
                  ),
              ],
            ),
            onPressed: () {
              setState(() {
                _currentIndex = 3; // Navigate to Kotak Masuk tab
              });
            },
          ),
          TextButton(
            onPressed: () {
              auth.logout();
            },
            child: const Text(
              'LOGOUT',
              style: TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.bold),
            ),
          )
        ],
      ),
      body: auth.connectionError
          ? LuxuryRetryWidget(
              onRetry: () => auth.fetchInitialData(),
              isLoading: auth.isLoading,
            )
          : _screens[_currentIndex],
      bottomNavigationBar: Theme(
        data: Theme.of(context).copyWith(
          canvasColor: cardBg,
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) {
            setState(() {
              _currentIndex = index;
            });
            auth.clearMessages();
          },
          selectedItemColor: const Color(0xFF00ADB5),
          unselectedItemColor: textMuted,
          showUnselectedLabels: true,
          selectedFontSize: 11,
          unselectedFontSize: 11,
          type: BottomNavigationBarType.fixed,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home_outlined), label: 'Home'),
            BottomNavigationBarItem(icon: Icon(Icons.gps_fixed_outlined), label: 'Absen'),
            BottomNavigationBarItem(icon: Icon(Icons.book_outlined), label: 'Training'),
            BottomNavigationBarItem(icon: Icon(Icons.notifications_outlined), label: 'Inbox'),
            BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'Profil'),
          ],
        ),
      ),
    );
  }
}

class LuxuryRetryWidget extends StatelessWidget {
  final VoidCallback onRetry;
  final bool isLoading;

  const LuxuryRetryWidget({
    Key? key,
    required this.onRetry,
    required this.isLoading,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    const bgMain = Color(0xFF222831);
    const bgSurface = Color(0xFF393E46);
    const accentPrimary = Color(0xFF00ADB5);
    const textMain = Color(0xFFEEEEEE);
    const textMuted = Color(0x8DEEEEEE);

    return Scaffold(
      backgroundColor: bgMain,
      body: Center(
        child: Container(
          margin: const EdgeInsets.all(24),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: bgSurface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: accentPrimary),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.5),
                blurRadius: 20,
                offset: const Offset(0, 10),
              )
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.1),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.red.withOpacity(0.3)),
                ),
                child: const Icon(
                  Icons.wifi_off_rounded,
                  color: Colors.redAccent,
                  size: 32,
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Koneksi Server Terputus',
                style: TextStyle(
                  color: textMain,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Gagal menghubungkan ke server API backend Barokah Grup.\nPastikan server aktif di: ${ApiClient.baseUrl.replaceAll('/api', '')} dan koneksi internet Anda stabil.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: textMuted,
                  fontSize: 12,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton.icon(
                  onPressed: isLoading ? null : onRetry,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: textMain,
                    foregroundColor: bgMain,
                    disabledBackgroundColor: textMain.withOpacity(0.3),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  icon: isLoading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            color: Color(0xFF00ADB5),
                            strokeWidth: 2,
                          ),
                        )
                      : const Icon(Icons.refresh_rounded, size: 20),
                  label: Text(
                    isLoading ? 'Menghubungkan...' : 'Coba Hubungkan Kembali',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextButton.icon(
                onPressed: () => _showServerConfigDialog(context),
                icon: const Icon(Icons.settings_ethernet_rounded, color: textMain, size: 16),
                label: const Text(
                  'Konfigurasi Server API',
                  style: TextStyle(color: textMain, fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showServerConfigDialog(BuildContext context) {
    final controller = TextEditingController(text: ApiClient.baseUrl);
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          title: const Text(
            'Atur Server API',
            style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Masukkan alamat server API aktif (IP MacBook Anda):',
                style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 12),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                style: const TextStyle(color: Color(0xFFEEEEEE)),
                decoration: InputDecoration(
                  hintText: 'http://192.168.1.37:5000',
                  hintStyle: const TextStyle(color: Color(0x8DEEEEEE)),
                  filled: true,
                  fillColor: const Color(0xFF222831),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFF00ADB5)),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
              },
              child: const Text('BATAL', style: TextStyle(color: Color(0x8DEEEEEE))),
            ),
            TextButton(
              onPressed: () async {
                final url = controller.text.trim();
                if (url.isNotEmpty) {
                  await ApiClient.setCustomBaseUrl(url);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Server API diubah ke: ${ApiClient.baseUrl}'),
                      backgroundColor: const Color(0xFF00ADB5),
                    ),
                  );
                  onRetry();
                }
                Navigator.pop(context);
              },
              child: const Text('SIMPAN', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }
}
