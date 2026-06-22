import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/auth_provider.dart';
import 'disc_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _discResult;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadDiscResult();
  }

  Future<void> _loadDiscResult() async {
    setState(() {
      _isLoading = true;
    });
    final prefs = await SharedPreferences.getInstance();
    final discStr = prefs.getString('hris_my_disc_result');
    if (discStr != null) {
      try {
        setState(() {
          _discResult = jsonDecode(discStr);
        });
      } catch (e) {
        print('Error decoding DISC cache: $e');
      }
    }
    setState(() {
      _isLoading = false;
    });
  }

  Widget _buildProfileItem(String label, String value) {
    const textMuted = Color(0x8DEEEEEE);
    const textMain = Color(0xFFEEEEEE);

    String displayValue = value;
    if (value.isNotEmpty && value != '-' && !label.contains('NIK') && !label.contains('EMAIL') && !label.contains('TANGGAL')) {
      displayValue = toTitleCase(value);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: textMuted, fontSize: 11)),
          const SizedBox(height: 4),
          Text(
            displayValue.isEmpty ? '—' : displayValue,
            style: const TextStyle(color: textMain, fontSize: 14, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          const Divider(color: Color(0x1AEEEEEE), height: 1),
        ],
      ),
    );
  }

  Widget _buildDiscGraph(String label, int pct, Color color) {
    const textMain = Color(0xFFEEEEEE);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: const TextStyle(color: textMain, fontSize: 12, fontWeight: FontWeight.bold),
              ),
              Text(
                '$pct%',
                style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct / 100.0,
              minHeight: 8,
              backgroundColor: const Color(0x0DEEEEEE),
              color: color,
            ),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final profile = auth.profile;

    const darkBg = Color(0xFF222831);
    const cardBg = Color(0xFF393E46);
    const accentColor = Color(0xFF00ADB5);
    const textMain = Color(0xFFEEEEEE);
    const textMuted = Color(0x8DEEEEEE);

    return Scaffold(
      backgroundColor: darkBg,
      appBar: AppBar(
        backgroundColor: darkBg,
        elevation: 0,
        title: const Text(
          'PROFIL SAYA',
          style: TextStyle(color: textMain, fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Header Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFEEEEEE).withOpacity(0.04)),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: accentColor.withOpacity(0.1),
                    child: const Icon(Icons.person, color: accentColor, size: 36),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          toTitleCase(profile?.fullName ?? 'Karyawan'),
                          style: const TextStyle(color: textMain, fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${toTitleCase(profile?.position ?? "Staff")} | ${toTitleCase(profile?.department ?? "Operasional")}',
                          style: const TextStyle(color: textMuted, fontSize: 12),
                        ),
                      ],
                    ),
                  )
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Induk Biodata
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFEEEEEE).withOpacity(0.04)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'INFORMASI KARYAWAN',
                    style: TextStyle(color: textMain, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                  ),
                  const SizedBox(height: 16),
                  _buildProfileItem('NOMOR INDUK KARYAWAN (NIK)', profile?.nik ?? '-'),
                  _buildProfileItem('EMAIL RESMI', profile?.email ?? '-'),
                  _buildProfileItem('JABATAN', profile?.position ?? '-'),
                  _buildProfileItem('DIVISI / DEPARTEMEN', profile?.department ?? '-'),
                  _buildProfileItem('OUTLET PENEMPATAN', profile?.outlet ?? '-'),
                  _buildProfileItem('TANGGAL BERGABUNG', profile?.joinedDate ?? '-'),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // DISC Psikogram Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFEEEEEE).withOpacity(0.04)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'HASIL PSIKOGRAM kepribadian (DISC)',
                    style: TextStyle(color: textMain, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                  ),
                  const SizedBox(height: 16),
                  if (_isLoading)
                    const Center(child: CircularProgressIndicator(color: accentColor))
                  else if (_discResult != null) ...[
                    _buildDiscGraph('Dominance (D)', _discResult!['d_score'] ?? 0, const Color(0xFFE74C3C)),
                    _buildDiscGraph('Influence (I)', _discResult!['i_score'] ?? 0, const Color(0xFFF1C40F)),
                    _buildDiscGraph('Steadiness (S)', _discResult!['s_score'] ?? 0, const Color(0xFF2ECC71)),
                    _buildDiscGraph('Compliance (C)', _discResult!['c_score'] ?? 0, const Color(0xFF3498DB)),
                    const SizedBox(height: 10),
                    const Text(
                      'Hasil tes ini digunakan oleh manajemen untuk mencocokkan gaya kerja dan kepemimpinan Anda.',
                      style: TextStyle(color: textMuted, fontSize: 11, height: 1.4),
                    ),
                  ] else ...[
                    const Text(
                      'Anda belum pernah mengambil tes psikogram kepribadian DISC.',
                      style: TextStyle(color: textMuted, fontSize: 12),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 44,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: accentColor,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const DiscScreen()),
                          ).then((_) => _loadDiscResult());
                        },
                        child: const Text(
                          'MULAI TES DISC SEKARANG',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}

String toTitleCase(String text) {
  if (text.isEmpty) return text;
  return text.split(' ').map((word) {
    if (word.isEmpty) return '';
    return word[0].toUpperCase() + word.substring(1).toLowerCase();
  }).join(' ');
}
