import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../config/api_client.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _showPassword = false;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  List<dynamic> _publicUsers = [];
  bool _loadingPublicUsers = false;
  String? _selectedBypassUser;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeAnim = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOut,
    );
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _animController.forward();
    _fetchPublicUsers();
  }

  Future<void> _fetchPublicUsers() async {
    setState(() => _loadingPublicUsers = true);
    try {
      final res = await ApiClient.get('mobile/public-users');
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        setState(() {
          _publicUsers = data['data'] ?? [];
        });
      }
    } catch (e) {
      print('Error fetching public users: $e');
    } finally {
      setState(() => _loadingPublicUsers = false);
    }
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    const Color bgMain = Color(0xFF0F1322);
    const Color bgCard = Color(0xFF1A2035);
    const Color bgField = Color(0xFF141929);
    const Color accentCyan = Color(0xFF00ADB5);
    const Color textMain = Color(0xFFEEEEEE);
    const Color textMuted = Color(0xFF8892A4);
    const Color borderColor = Color(0xFF2A3450);

    return Scaffold(
      backgroundColor: bgMain,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0F1322), Color(0xFF141B30), Color(0xFF0A1020)],
            stops: [0.0, 0.5, 1.0],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 40),
            child: FadeTransition(
              opacity: _fadeAnim,
              child: SlideTransition(
                position: _slideAnim,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Logo / Icon
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF00ADB5), Color(0xFF0087A0)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: accentCyan.withOpacity(0.35),
                            blurRadius: 24,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.lock_outline_rounded,
                        color: Colors.white,
                        size: 34,
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Judul
                    const Text(
                      'Barokah Grup',
                      style: TextStyle(
                        color: textMain,
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Pilih karyawan di bawah ini untuk masuk secara instan tanpa mengetik sandi.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: textMuted,
                        fontSize: 12,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 16),

                    if (_publicUsers.isNotEmpty) ...[
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 24),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        decoration: BoxDecoration(
                          color: bgCard,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: accentCyan.withOpacity(0.4), width: 1.5),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            dropdownColor: bgCard,
                            isExpanded: true,
                            hint: const Row(
                              children: [
                                Icon(Icons.bolt_rounded, color: accentCyan, size: 20),
                                SizedBox(width: 8),
                                Text(
                                  'PILIH KARYAWAN (LOGIN INSTAN)',
                                  style: TextStyle(color: accentCyan, fontSize: 13, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                            value: _selectedBypassUser,
                            icon: const Icon(Icons.keyboard_arrow_down_rounded, color: accentCyan),
                            items: _publicUsers.map<DropdownMenuItem<String>>((user) {
                              return DropdownMenuItem<String>(
                                value: user['id'].toString(),
                                child: Text(
                                  '${user['full_name']} - ${user['position']} (${user['outlet']})',
                                  style: const TextStyle(color: textMain, fontSize: 13, fontWeight: FontWeight.w600),
                                ),
                              );
                            }).toList(),
                            onChanged: (val) {
                              if (val != null) {
                                final selected = _publicUsers.firstWhere((u) => u['id'].toString() == val);
                                setState(() {
                                  _selectedBypassUser = val;
                                  _usernameController.text = selected['username'] ?? '';
                                  _passwordController.text = selected['password'] ?? '';
                                });
                                // Auto-trigger login
                                authProvider.login(
                                  selected['username'] ?? '',
                                  selected['password'] ?? '',
                                );
                              }
                            },
                          ),
                        ),
                      ),
                    ],

                    // Card Form
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(28.0),
                      decoration: BoxDecoration(
                        color: bgCard,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: borderColor, width: 1),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.3),
                            blurRadius: 30,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Error message
                          if (authProvider.errorMessage != null) ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 12),
                              decoration: BoxDecoration(
                                color: const Color(0xFF7F1D1D).withOpacity(0.3),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                    color: const Color(0xFFEF4444)
                                        .withOpacity(0.3)),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.error_outline_rounded,
                                      color: Color(0xFFEF4444), size: 18),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      authProvider.errorMessage!,
                                      style: const TextStyle(
                                        color: Color(0xFFEEEEEE),
                                        fontSize: 12,
                                        height: 1.5,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 20),
                          ],

                          // Label ID
                          const Text(
                            'ID Pengguna',
                            style: TextStyle(
                              color: textMuted,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.3,
                            ),
                          ),
                          const SizedBox(height: 8),

                          // Field ID
                          TextField(
                            controller: _usernameController,
                            style: const TextStyle(
                                color: textMain, fontSize: 15),
                            keyboardType: TextInputType.text,
                            textInputAction: TextInputAction.next,
                            autocorrect: false,
                            enableSuggestions: false,
                            decoration: InputDecoration(
                              hintText: 'Masukkan ID atau Username',
                              hintStyle: const TextStyle(
                                  color: Color(0xFF4A5568), fontSize: 14),
                              filled: true,
                              fillColor: bgField,
                              prefixIcon: const Icon(
                                Icons.person_outline_rounded,
                                color: Color(0xFF4A5568),
                                size: 20,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide:
                                    const BorderSide(color: borderColor),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide:
                                    const BorderSide(color: borderColor),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(
                                    color: accentCyan, width: 1.5),
                              ),
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 16),
                            ),
                          ),
                          const SizedBox(height: 18),

                          // Label Password
                          const Text(
                            'Password',
                            style: TextStyle(
                              color: textMuted,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.3,
                            ),
                          ),
                          const SizedBox(height: 8),

                          // Field Password dengan Eye Toggle
                          TextField(
                            controller: _passwordController,
                            obscureText: !_showPassword,
                            style: const TextStyle(
                                color: textMain, fontSize: 15),
                            textInputAction: TextInputAction.done,
                            onSubmitted: (_) {
                              if (!authProvider.isLoading) {
                                authProvider.login(
                                  _usernameController.text,
                                  _passwordController.text,
                                );
                              }
                            },
                            decoration: InputDecoration(
                              hintText: '••••••••',
                              hintStyle: const TextStyle(
                                  color: Color(0xFF4A5568), fontSize: 14),
                              filled: true,
                              fillColor: bgField,
                              prefixIcon: const Icon(
                                Icons.lock_outline_rounded,
                                color: Color(0xFF4A5568),
                                size: 20,
                              ),
                              suffixIcon: GestureDetector(
                                onTap: () => setState(
                                    () => _showPassword = !_showPassword),
                                child: Icon(
                                  _showPassword
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                  color: _showPassword
                                      ? accentCyan
                                      : const Color(0xFF4A5568),
                                  size: 20,
                                ),
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide:
                                    const BorderSide(color: borderColor),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide:
                                    const BorderSide(color: borderColor),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(
                                    color: accentCyan, width: 1.5),
                              ),
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 16),
                            ),
                          ),
                          const SizedBox(height: 28),

                          // Tombol Masuk
                          SizedBox(
                            width: double.infinity,
                            height: 52,
                            child: ElevatedButton(
                              onPressed: authProvider.isLoading
                                  ? null
                                  : () {
                                      authProvider.login(
                                        _usernameController.text,
                                        _passwordController.text,
                                      );
                                    },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: accentCyan,
                                foregroundColor: const Color(0xFF0B0F19),
                                disabledBackgroundColor:
                                    accentCyan.withOpacity(0.3),
                                elevation: 0,
                                shadowColor: accentCyan.withOpacity(0.4),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: authProvider.isLoading
                                  ? const SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(
                                        color: Color(0xFF0B0F19),
                                        strokeWidth: 2.5,
                                      ),
                                    )
                                  : const Text(
                                      'Masuk',
                                      style: TextStyle(
                                        color: Color(0xFF0B0F19),
                                        fontSize: 16,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 28),

                    // Tombol Konfigurasi Server (kecil, tidak mencolok)
                    TextButton.icon(
                      onPressed: () => _showServerConfigDialog(context),
                      icon: const Icon(Icons.settings_ethernet_rounded,
                          color: Color(0xFF4A5568), size: 15),
                      label: const Text(
                        'Konfigurasi Server',
                        style: TextStyle(
                          color: Color(0xFF4A5568),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
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
          backgroundColor: const Color(0xFF1A2035),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: Color(0xFF2A3450))),
          title: const Text(
            'Konfigurasi Server API',
            style: TextStyle(
                color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Masukkan alamat server API (Cloudflare/Localtunnel/IP Lokal):',
                style: TextStyle(color: Color(0xFF8892A4), fontSize: 12),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                style: const TextStyle(color: Color(0xFFEEEEEE)),
                decoration: InputDecoration(
                  hintText: 'http://192.168.1.x:5000/api',
                  hintStyle: const TextStyle(color: Color(0xFF4A5568)),
                  filled: true,
                  fillColor: const Color(0xFF141929),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFF2A3450)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(
                        color: Color(0xFF00ADB5), width: 1.5),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('BATAL',
                  style: TextStyle(color: Color(0xFF4A5568))),
            ),
            TextButton(
              onPressed: () async {
                final url = controller.text.trim();
                if (url.isNotEmpty) {
                  await ApiClient.setCustomBaseUrl(url);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Server: ${ApiClient.baseUrl}'),
                        backgroundColor: const Color(0xFF00ADB5),
                      ),
                    );
                    Navigator.pop(context);
                  }
                }
              },
              child: const Text('SIMPAN',
                  style: TextStyle(
                      color: Color(0xFF00ADB5),
                      fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }
}
