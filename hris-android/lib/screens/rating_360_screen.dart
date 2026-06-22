import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/auth_provider.dart';
import '../config/api_client.dart';

class Rating360Screen extends StatefulWidget {
  const Rating360Screen({Key? key}) : super(key: key);

  @override
  State<Rating360Screen> createState() => _Rating360ScreenState();
}

class _Rating360ScreenState extends State<Rating360Screen> {
  List<dynamic> _colleagues = [];
  Set<int> _alreadyRatedIds = {};
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchColleagues();
  }

  Future<void> _fetchColleagues() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final res = await ApiClient.get('employees/my-outlet', token: auth.token);
      final data = jsonDecode(res.body);

      if (res.statusCode == 200 && data['status'] == 'success') {
        _colleagues = data['data'] ?? [];
        await _loadRatedLocalList();
      } else {
        _errorMessage = data['message'] ?? 'Gagal mengambil data rekan kerja.';
      }
    } catch (e) {
      _errorMessage = 'Koneksi ke server API terganggu.';
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _loadRatedLocalList() async {
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final myEmpId = auth.profile?.employeeId ?? 0;
      final prefs = await SharedPreferences.getInstance();
      final List<String>? ratedList = prefs.getStringList('hris_360_rated_ids_$myEmpId');
      if (ratedList != null) {
        _alreadyRatedIds = ratedList.map((idStr) => int.parse(idStr)).toSet();
      }
    } catch (e) {
      print('Gagal memuat cache local rating: $e');
    }
  }

  Future<void> _markAsRatedLocal(int targetId) async {
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final myEmpId = auth.profile?.employeeId ?? 0;
      final prefs = await SharedPreferences.getInstance();
      _alreadyRatedIds.add(targetId);
      final listStr = _alreadyRatedIds.map((id) => id.toString()).toList();
      await prefs.setStringList('hris_360_rated_ids_$myEmpId', listStr);
      setState(() {});
    } catch (e) {
      print('Gagal menyimpan cache local rating: $e');
    }
  }

  void _openRatingForm(Map<String, dynamic> colleague) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => RatingFormScreen(
          colleague: colleague,
          onSuccess: () {
            _markAsRatedLocal(colleague['id'] as int);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Penilaian 360° berhasil dikirimkan secara anonim!'),
                backgroundColor: Color(0xFF10B981),
              ),
            );
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
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
          'PENILAIAN SEJAWAT 360°',
          style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 1),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFFEEEEEE)),
            onPressed: _fetchColleagues,
          )
        ],
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
                          onPressed: _fetchColleagues,
                          child: const Text('Coba Lagi', style: TextStyle(color: accentColor)),
                        )
                      ],
                    ),
                  ),
                )
              : _colleagues.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24.0),
                        child: Text(
                          'Tidak ada rekan kerja lain di outlet Anda yang aktif.',
                          style: TextStyle(color: textMuted, fontSize: 13),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16.0),
                      itemCount: _colleagues.length,
                      itemBuilder: (context, index) {
                        final colleague = _colleagues[index];
                        final id = colleague['id'] as int;
                        final isRated = _alreadyRatedIds.contains(id);

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: cardBg,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.04)),
                          ),
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            title: Text(
                              colleague['full_name'] ?? 'Karyawan',
                              style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 15, fontWeight: FontWeight.bold),
                            ),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 4.0),
                              child: Text(
                                '${colleague['position'] ?? "-"} | Outlet: ${colleague['outlet'] ?? "-"}',
                                style: const TextStyle(color: textMuted, fontSize: 12),
                              ),
                            ),
                            trailing: isRated
                                ? Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF10B981).withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: const Color(0xFF10B981)),
                                    ),
                                    child: const Text(
                                      'Sudah Dinilai',
                                      style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold),
                                    ),
                                  )
                                : ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: accentColor,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    ),
                                    onPressed: () => _openRatingForm(colleague),
                                    child: const Text(
                                      'Nilai',
                                      style: TextStyle(color: Colors.black, fontSize: 12, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                          ),
                        );
                      },
                    ),
    );
  }
}

class RatingFormScreen extends StatefulWidget {
  final Map<String, dynamic> colleague;
  final VoidCallback onSuccess;

  const RatingFormScreen({Key? key, required this.colleague, required this.onSuccess}) : super(key: key);

  @override
  State<RatingFormScreen> createState() => _RatingFormScreenState();
}

class _RatingFormScreenState extends State<RatingFormScreen> {
  // 5 Pertanyaan Kompetensi Utama
  final List<Map<String, String>> _questions = [
    {
      'kategori': 'Kedisiplinan Kerja',
      'soal': 'Bagaimana tingkat ketepatan waktu rekan kerja ini saat memulai giliran kerja (shift) dan kembali dari waktu istirahat?'
    },
    {
      'kategori': 'Inisiatif Kerja',
      'soal': 'Seberapa sigap rekan kerja ini dalam membantu menyelesaikan tugas operasional dapur/pelayanan tanpa harus menunggu perintah dari Leader?'
    },
    {
      'kategori': 'Keramahan & Kerja Sama',
      'soal': 'Bagaimana sikap, komunikasi, dan keramahan rekan kerja ini saat bekerja sama dalam tim di bawah tekanan situasi outlet yang padat (rush hour)?'
    },
    {
      'kategori': 'Kebersihan & Kepatuhan SOP',
      'soal': 'Seberapa konsisten rekan kerja ini dalam menjaga kebersihan area kerja pribadi serta mematuhi aturan baku operasional (SOP) Barokah Grup?'
    },
    {
      'kategori': 'Etika Profesional',
      'soal': 'Bagaimana sikap rekan kerja ini dalam menjaga kejujuran, tidak membicarakan keburukan rekan lain di belakang, dan menghargai sesama karyawan?'
    },
  ];

  // Opsi jawaban & skor
  final List<Map<String, dynamic>> _options = [
    {'opsi': 'A. Sangat Buruk', 'skor': 1},
    {'opsi': 'B. Buruk', 'skor': 2},
    {'opsi': 'C. Cukup', 'skor': 3},
    {'opsi': 'D. Baik', 'skor': 4},
    {'opsi': 'E. Sangat Baik', 'skor': 5},
  ];

  // Menyimpan jawaban terpilih untuk 5 soal (0 - 4 indeks)
  final Map<int, int> _answers = {};
  bool _submitting = false;

  void _submitRating() async {
    if (_answers.length < 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Harap lengkapi semua pertanyaan sebelum mengirim.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }

    // Tampilkan konfirmasi
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Kirim Penilaian Anonim?', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
          content: const Text(
            'Penilaian ini dikirim secara rahasia. Identitas Anda sebagai penilai tidak akan dicatat oleh sistem sama sekali.',
            style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 13, height: 1.5),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('BATAL', style: TextStyle(color: Color(0x8DEEEEEE))),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEEEEEE)),
              onPressed: () {
                Navigator.pop(context);
                _executePost();
              },
              child: const Text('YA, KIRIM', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            )
          ],
        );
      },
    );
  }

  Future<void> _executePost() async {
    setState(() {
      _submitting = true;
    });

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final payload = {
        'employee_id': widget.colleague['id'],
        'kedisiplinan': _answers[0],
        'inisiatif': _answers[1],
        'kerjasama': _answers[2],
        'kebersihan': _answers[3],
        'etika': _answers[4],
      };

      final res = await ApiClient.post('kpis/360-ratings', payload, token: auth.token);
      final data = jsonDecode(res.body);

      if (res.statusCode == 200 && data['status'] == 'success') {
        widget.onSuccess();
        Navigator.pop(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['message'] ?? 'Gagal mengirim penilaian.'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Kesalahan koneksi jaringan.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
    } finally {
      setState(() {
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
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
          icon: const Icon(Icons.close, color: Color(0xFFEEEEEE)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          children: [
            const Text(
              'FORM EVALUASI SEJAWAT',
              style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 1),
            ),
            Text(
              'Target: ${widget.colleague['full_name']}',
              style: const TextStyle(color: textMuted, fontSize: 11),
            )
          ],
        ),
        centerTitle: true,
      ),
      body: _submitting
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00ADB5)))
          : ListView(
              padding: const EdgeInsets.all(16.0),
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: accentColor.withOpacity(0.06),
                    border: Border.all(color: accentColor.withOpacity(0.2)),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: const [
                      Icon(Icons.lock_person, color: Color(0xFF10B981), size: 20),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Sistem Anonim Aktif: Pilihan Anda dienkripsi tanpa menyimpan identitas akun Anda.',
                          style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
                
                // Form Soal
                ...List.generate(_questions.length, (index) {
                  final q = _questions[index];
                  final selectedScore = _answers[index];

                  return Container(
                    margin: const EdgeInsets.only(bottom: 24),
                    padding: const EdgeInsets.all(16.0),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.05)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Kategori & No Soal
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: accentColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                q['kategori']!.toUpperCase(),
                                style: const TextStyle(color: accentColor, fontSize: 9, fontWeight: FontWeight.bold),
                              ),
                            ),
                            Text(
                              'Soal ${index + 1} dari 5',
                              style: const TextStyle(color: textMuted, fontSize: 11),
                            )
                          ],
                        ),
                        const SizedBox(height: 12),
                        // Deskripsi Soal
                        Text(
                          q['soal']!,
                          style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, height: 1.5, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 16),
                        // Opsi Jawaban
                        ..._options.map((opt) {
                          final score = opt['skor'] as int;
                          final isSelected = selectedScore == score;

                          return InkWell(
                            onTap: () {
                              setState(() {
                                _answers[index] = score;
                              });
                            },
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: isSelected ? accentColor.withOpacity(0.12) : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isSelected ? accentColor : Color(0xFFEEEEEE).withOpacity(0.06),
                                  width: isSelected ? 1.5 : 1,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                                    color: isSelected ? accentColor : textMuted,
                                    size: 18,
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      opt['opsi']!,
                                      style: TextStyle(
                                        color: isSelected ? Color(0xFFEEEEEE) : Color(0x8DEEEEEE),
                                        fontSize: 12,
                                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    '($score Poin)',
                                    style: TextStyle(color: isSelected ? accentColor : textMuted, fontSize: 11),
                                  )
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ],
                    ),
                  );
                }),

                const SizedBox(height: 10),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accentColor,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: _submitRating,
                  child: const Text(
                    'KIRIM PENILAIAN ANONIM',
                    style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                  ),
                ),
                const SizedBox(height: 30),
              ],
            ),
    );
  }
}
