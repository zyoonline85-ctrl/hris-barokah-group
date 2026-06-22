import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/auth_provider.dart';
import '../config/api_client.dart';

class KpiReportScreen extends StatefulWidget {
  const KpiReportScreen({Key? key}) : super(key: key);

  @override
  State<KpiReportScreen> createState() => _KpiReportScreenState();
}

class _KpiReportScreenState extends State<KpiReportScreen> {
  List<dynamic> _ratings = [];
  bool _isLoading = false;
  String? _errorMessage;

  // Skor akumulasi hasil kalkulasi
  int? _kpiScore;
  int _evaluatorCount = 0;
  String _predicate = 'BELUM DINILAI';
  Color _predicateColor = const Color(0xFF7F8C8D);

  // Rata-rata per kriteria (skala 1-5)
  double _avgDisiplin = 0;
  double _avgInisiatif = 0;
  double _avgKerjasama = 0;
  double _avgKebersihan = 0;
  double _avgEtika = 0;

  @override
  void initState() {
    super.initState();
    _loadCacheAndFetch();
  }

  Future<void> _loadCacheAndFetch() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final prefs = await SharedPreferences.getInstance();
    final cachedDataStr = prefs.getString('hris_my_360_ratings_cache');
    if (cachedDataStr != null) {
      try {
        final cachedData = jsonDecode(cachedDataStr);
        _ratings = cachedData;
        _calculateKpi();
      } catch (e) {
        print('Error decoding rating cache: $e');
      }
    }

    _fetchRatingsFromServer();
  }

  Future<void> _fetchRatingsFromServer() async {
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final res = await ApiClient.get('kpis/360-ratings', token: auth.token);
      final data = jsonDecode(res.body);

      if (res.statusCode == 200 && data['status'] == 'success') {
        final list = data['data'] ?? [];
        _ratings = list;

        // Simpan cache
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('hris_my_360_ratings_cache', jsonEncode(list));

        _calculateKpi();
      } else {
        if (_ratings.isEmpty) {
          _errorMessage = data['message'] ?? 'Gagal mengambil data rapor KPI.';
        }
      }
    } catch (e) {
      if (_ratings.isEmpty) {
        _errorMessage = 'Koneksi ke server API terganggu.';
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _calculateKpi() {
    _evaluatorCount = _ratings.length;
    if (_evaluatorCount == 0) {
      _kpiScore = null;
      _predicate = 'BELUM DINILAI';
      _predicateColor = const Color(0xFF7F8C8D);
      _avgDisiplin = 0;
      _avgInisiatif = 0;
      _avgKerjasama = 0;
      _avgKebersihan = 0;
      _avgEtika = 0;
      setState(() {});
      return;
    }

    double totalDisiplin = 0;
    double totalInisiatif = 0;
    double totalKerjasama = 0;
    double totalKebersihan = 0;
    double totalEtika = 0;

    for (var r in _ratings) {
      totalDisiplin += (r['kedisiplinan'] ?? 0).toDouble();
      totalInisiatif += (r['inisiatif'] ?? 0).toDouble();
      totalKerjasama += (r['kerjasama'] ?? 0).toDouble();
      totalKebersihan += (r['kebersihan'] ?? 0).toDouble();
      totalEtika += (r['etika'] ?? 0).toDouble();
    }

    double totalPoin = totalDisiplin + totalInisiatif + totalKerjasama + totalKebersihan + totalEtika;

    // Rumus Matematika KPI: Skor Akhir KPI = (Total Poin) / (Total Soal (5) * N) * 20
    _kpiScore = ((totalPoin / (5 * _evaluatorCount)) * 20).round();

    // Rata-rata per kriteria
    _avgDisiplin = totalDisiplin / _evaluatorCount;
    _avgInisiatif = totalInisiatif / _evaluatorCount;
    _avgKerjasama = totalKerjasama / _evaluatorCount;
    _avgKebersihan = totalKebersihan / _evaluatorCount;
    _avgEtika = totalEtika / _evaluatorCount;

    // Tentukan Predikat
    if (_kpiScore! >= 90) {
      _predicate = 'ISTIMEWA';
      _predicateColor = const Color(0xFF2ECC71); // Hijau Daun Neon
    } else if (_kpiScore! >= 75) {
      _predicate = 'BAIK';
      _predicateColor = const Color(0xFFEEEEEE); // Krem Kayu
    } else {
      _predicate = 'BUTUH EVALUASI';
      _predicateColor = const Color(0xFFE74C3C); // Merah Cabai
    }
    setState(() {});
  }

  Widget _buildCompetencyRow(String title, double score) {
    const textMuted = Color(0x8DEEEEEE);
    const accentColor = Color(0xFFEEEEEE);
    // Skala progress 0.0 s.d 1.0 (nilai 1-5 dibagi 5)
    double progress = score / 5.0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 18.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, fontWeight: FontWeight.w500),
              ),
              Row(
                children: [
                  Text(
                    score.toStringAsFixed(1),
                    style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  const Text(' / 5.0', style: TextStyle(color: textMuted, fontSize: 11)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: Color(0xFFEEEEEE).withOpacity(0.05),
              color: score >= 4.5
                  ? const Color(0xFF2ECC71)
                  : score >= 3.5
                      ? accentColor
                      : const Color(0xFFE74C3C),
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
    const accentColor = Color(0xFFEEEEEE);
    const textMuted = Color(0x8DEEEEEE);

    return Scaffold(
      backgroundColor: darkBg,
      appBar: AppBar(
        backgroundColor: darkBg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFFEEEEEE)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'RAPOR KPI PENILAIAN 360°',
          style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1),
        ),
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00ADB5)))
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, color: Color(0xFFEF4444), size: 48),
                        const SizedBox(height: 12),
                        Text(_errorMessage!, style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 14), textAlign: TextAlign.center),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(backgroundColor: cardBg),
                          onPressed: _loadCacheAndFetch,
                          child: const Text('Coba Lagi', style: TextStyle(color: accentColor)),
                        )
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  color: accentColor,
                  onRefresh: _fetchRatingsFromServer,
                  child: ListView(
                    padding: const EdgeInsets.all(16.0),
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      // Ringkasan Profil Karyawan
                      Container(
                        padding: const EdgeInsets.all(16.0),
                        decoration: BoxDecoration(
                          color: cardBg,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.04)),
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 24,
                              backgroundColor: Color(0xFFEEEEEE).withOpacity(0.08),
                              child: const Icon(Icons.person, color: accentColor, size: 28),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    toTitleCase(profile?.fullName ?? 'Karyawan'),
                                    style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${toTitleCase(profile?.position ?? "-")} | Outlet: ${toTitleCase(profile?.outlet ?? "-")}',
                                    style: const TextStyle(color: textMuted, fontSize: 12),
                                  ),
                                ],
                              ),
                            )
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Card Skor Utama Rapor
                      Container(
                        padding: const EdgeInsets.all(24.0),
                        decoration: BoxDecoration(
                          color: cardBg,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.04)),
                          boxShadow: [
                            BoxShadow(
                              color: _kpiScore != null ? _predicateColor.withOpacity(0.05) : Colors.transparent,
                              blurRadius: 20,
                              spreadRadius: 2,
                            )
                          ],
                        ),
                        child: Column(
                          children: [
                            const Text(
                              'SKOR AKHIR KPI',
                              style: TextStyle(color: textMuted, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                            ),
                            const SizedBox(height: 16),
                            
                            // Visualisasi Skor Berwarna
                            Text(
                              _kpiScore != null ? '$_kpiScore' : '-',
                              style: TextStyle(
                                color: _kpiScore != null ? _predicateColor : Color(0x1AEEEEEE),
                                fontSize: 64,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const Text(
                              'Skala 100',
                              style: TextStyle(color: textMuted, fontSize: 11),
                            ),
                            const SizedBox(height: 20),
                            
                            // Badge Predikat
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                              decoration: BoxDecoration(
                                color: _kpiScore != null ? _predicateColor.withOpacity(0.08) : Colors.transparent,
                                border: Border.all(color: _kpiScore != null ? _predicateColor : Color(0x1AEEEEEE), width: 1.5),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                toTitleCase(_predicate),
                                style: TextStyle(
                                  color: _predicateColor,
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            
                            // Keterangan Evaluator
                            Text(
                              _kpiScore != null
                                  ? 'Diakumulasikan secara anonim dari ulasan $_evaluatorCount rekan kerja Anda.'
                                  : 'Belum ada penilaian sejawat yang masuk untuk Anda.',
                              style: const TextStyle(color: textMuted, fontSize: 11),
                              textAlign: TextAlign.center,
                            )
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Detail Kompetensi
                      if (_kpiScore != null) ...[
                        const Text(
                          'RINCIAN KOMPETENSI KERJA',
                          style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(20.0),
                          decoration: BoxDecoration(
                            color: cardBg,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.04)),
                          ),
                          child: Column(
                            children: [
                              _buildCompetencyRow('Kedisiplinan Kerja', _avgDisiplin),
                              _buildCompetencyRow('Inisiatif Kerja', _avgInisiatif),
                              _buildCompetencyRow('Keramahan & Kerja Sama', _avgKerjasama),
                              _buildCompetencyRow('Kebersihan & SOP', _avgKebersihan),
                              _buildCompetencyRow('Etika Profesional', _avgEtika),
                            ],
                          ),
                        ),
                      ] else ...[
                        Container(
                          padding: const EdgeInsets.all(24.0),
                          decoration: BoxDecoration(
                            color: cardBg,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Center(
                            child: Text(
                              'Hasil rincian kompetensi akan muncul di sini setelah rekan kerja menyelesaikan penilaian 360° untuk Anda.',
                              style: TextStyle(color: textMuted, fontSize: 12),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        )
                      ],
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
