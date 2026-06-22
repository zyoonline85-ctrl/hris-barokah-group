import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../config/api_client.dart';

class DiscScreen extends StatefulWidget {
  const DiscScreen({Key? key}) : super(key: key);

  @override
  State<DiscScreen> createState() => _DiscScreenState();
}

class _DiscScreenState extends State<DiscScreen> {
  int _currentStep = 0;
  bool _isLoading = false;
  
  // Answers: key is question index, value is Map with 'most' and 'least' indices (0 to 3)
  final Map<int, Map<String, int>> _answers = {};

  // 28 Questions mapping to D, I, S, C
  // Each option maps to D, I, S, or C respectively
  final List<List<Map<String, dynamic>>> _questions = [
    [
      {'text': 'Gamblang, tegas, langsung to the point', 'type': 'D'},
      {'text': 'Suka bergaul, ramah, persuasif', 'type': 'I'},
      {'text': 'Sabar, tenang, pendengar yang baik', 'type': 'S'},
      {'text': 'Teliti, rapi, patuh pada aturan', 'type': 'C'},
    ],
    [
      {'text': 'Kompetitif, suka tantangan besar', 'type': 'D'},
      {'text': 'Antusias, penuh semangat, ekspresif', 'type': 'I'},
      {'text': 'Suka membantu, loyal, kooperatif', 'type': 'S'},
      {'text': 'Logis, analitis, penuh pertimbangan', 'type': 'C'},
    ],
    [
      {'text': 'Mandiri, dominan, cepat mengambil keputusan', 'type': 'D'},
      {'text': 'Optimis, ceria, menginspirasi orang lain', 'type': 'I'},
      {'text': 'Stabil, konsisten, menyukai rutinitas', 'type': 'S'},
      {'text': 'Disiplin tinggi, akurat, perfeksionis', 'type': 'C'},
    ],
    [
      {'text': 'Berani mengambil risiko, gigih', 'type': 'D'},
      {'text': 'Menyenangkan, komunikatif, pandai bicara', 'type': 'I'},
      {'text': 'Mudah bersepakat, pemaaf, toleran', 'type': 'S'},
      {'text': 'Sistematis, terstruktur, berorientasi fakta', 'type': 'C'},
    ],
    // Let's generate all 28 groups dynamically to make it complete and robust
    // Using a cyclic structure of standard descriptors to represent the 28 questions
    [
      {'text': 'Berorientasi pada hasil akhir', 'type': 'D'},
      {'text': 'Suka menjadi pusat perhatian', 'type': 'I'},
      {'text': 'Menghindari konflik langsung', 'type': 'S'},
      {'text': 'Sangat berhati-hati dalam bertindak', 'type': 'C'},
    ],
    [
      {'text': 'Mengendalikan situasi sekitar', 'type': 'D'},
      {'text': 'Mendorong orang lain bekerja sama', 'type': 'I'},
      {'text': 'Menyukai lingkungan damai', 'type': 'S'},
      {'text': 'Menyukai standar kualitas tinggi', 'type': 'C'},
    ],
    [
      {'text': 'Ambisius dan cepat bertindak', 'type': 'D'},
      {'text': 'Menghidupkan suasana tim', 'type': 'I'},
      {'text': 'Sabar menghadapi keluhan', 'type': 'S'},
      {'text': 'Memeriksa detail berulang kali', 'type': 'C'},
    ],
    [
      {'text': 'Fokus mencapai target operasional', 'type': 'D'},
      {'text': 'Pandai memotivasi rekan kerja', 'type': 'I'},
      {'text': 'Setia pada satu cara kerja lama', 'type': 'S'},
      {'text': 'Menyukai penjelasan tertulis detail', 'type': 'C'},
    ],
    [
      {'text': 'Tegas menolak hal tidak efektif', 'type': 'D'},
      {'text': 'Suka mengobrol dan bersosialisasi', 'type': 'I'},
      {'text': 'Pendengar setia masalah orang', 'type': 'S'},
      {'text': 'Menuntut kerapian meja kerja', 'type': 'C'},
    ],
    [
      {'text': 'Menantang aturan tidak masuk akal', 'type': 'D'},
      {'text': 'Percaya diri tampil di depan', 'type': 'I'},
      {'text': 'Mudah menyesuaikan ritme kerja', 'type': 'S'},
      {'text': 'Bekerja berdasarkan standar operasional', 'type': 'C'},
    ],
    [
      {'text': 'Mandiri dalam memecahkan masalah', 'type': 'D'},
      {'text': 'Suka memuji kerja keras tim', 'type': 'I'},
      {'text': 'Suka bekerja di balik layar', 'type': 'S'},
      {'text': 'Membuat perencanaan tertulis matang', 'type': 'C'},
    ],
    [
      {'text': 'Menuntut kecepatan respon tim', 'type': 'D'},
      {'text': 'Menyukai presentasi visual indah', 'type': 'I'},
      {'text': 'Tenang di bawah tekanan kerja', 'type': 'S'},
      {'text': 'Skeptis sebelum melihat bukti', 'type': 'C'},
    ],
    [
      {'text': 'Suka memimpin proyek baru', 'type': 'D'},
      {'text': 'Suka membangun networking luas', 'type': 'I'},
      {'text': 'Membantu menstabilkan suasana tim', 'type': 'S'},
      {'text': 'Mematuhi alur koordinasi resmi', 'type': 'C'},
    ],
    [
      {'text': 'Berani menghadapi tantangan baru', 'type': 'D'},
      {'text': 'Mudah akrab dengan orang baru', 'type': 'I'},
      {'text': 'Menolak perubahan mendadak', 'type': 'S'},
      {'text': 'Selalu mengacu pada data statistik', 'type': 'C'},
    ],
    [
      {'text': 'Mengambil tanggung jawab penuh', 'type': 'D'},
      {'text': 'Penuh humor dan mencairkan suasana', 'type': 'I'},
      {'text': 'Mendukung keputusan mayoritas', 'type': 'S'},
      {'text': 'Menganalisis kegagalan secara logis', 'type': 'C'},
    ],
    [
      {'text': 'Bekerja keras demi pencapaian karir', 'type': 'D'},
      {'text': 'Memiliki imajinasi kreatif tinggi', 'type': 'I'},
      {'text': 'Menyukai instruksi kerja bertahap', 'type': 'S'},
      {'text': 'Menjaga kerahasiaan informasi penting', 'type': 'C'},
    ],
    [
      {'text': 'Mengatasi kendala tanpa menyerah', 'type': 'D'},
      {'text': 'Mempengaruhi pendapat orang lain', 'type': 'I'},
      {'text': 'Rendah hati dan tidak menonjol', 'type': 'S'},
      {'text': 'Fokus pada keakuratan angka', 'type': 'C'},
    ],
    [
      {'text': 'Cepat mengambil kendali darurat', 'type': 'D'},
      {'text': 'Ekspresif dalam menyampaikan ide', 'type': 'I'},
      {'text': 'Menghargai tradisi kekeluargaan', 'type': 'S'},
      {'text': 'Suka meneliti kelemahan sistem', 'type': 'C'},
    ],
    [
      {'text': 'Berani mengemukakan argumen berbeda', 'type': 'D'},
      {'text': 'Mudah bergaul dalam forum besar', 'type': 'I'},
      {'text': 'Menghindari persaingan tidak sehat', 'type': 'S'},
      {'text': 'Bekerja mandiri secara teratur', 'type': 'C'},
    ],
    [
      {'text': 'Mengarahkan tim ke target utama', 'type': 'D'},
      {'text': 'Menyukai pujian atas hasil kerja', 'type': 'I'},
      {'text': 'Suka berbagi beban kerja tim', 'type': 'S'},
      {'text': 'Menyukai proses audit independen', 'type': 'C'},
    ],
    [
      {'text': 'Kompetitif menghadapi rekan kerja', 'type': 'D'},
      {'text': 'Mencari cara unik bersenang-senang', 'type': 'I'},
      {'text': 'Mengutamakan keharmonisan kantor', 'type': 'S'},
      {'text': 'Bekerja ketat mengikuti panduan SOP', 'type': 'C'},
    ],
    [
      {'text': 'Menargetkan pertumbuhan yang cepat', 'type': 'D'},
      {'text': 'Aktif memimpin diskusi santai', 'type': 'I'},
      {'text': 'Tenang meredam kemarahan orang', 'type': 'S'},
      {'text': 'Menulis laporan evaluasi berkala', 'type': 'C'},
    ],
    [
      {'text': 'Tegas menentukan alokasi tugas', 'type': 'D'},
      {'text': 'Antusias menyambut ide inovatif', 'type': 'I'},
      {'text': 'Menyukai rasa aman posisi tetap', 'type': 'S'},
      {'text': 'Mengabaikan gosip tanpa bukti logis', 'type': 'C'},
    ],
    [
      {'text': 'Mengutamakan kecepatan penyelesaian', 'type': 'D'},
      {'text': 'Menyukai aktivitas sosial seru', 'type': 'I'},
      {'text': 'Menerima arahan atasan dengan baik', 'type': 'S'},
      {'text': 'Memeriksa validitas dokumen masuk', 'type': 'C'},
    ],
    [
      {'text': 'Pantang mundur hadapi kritik', 'type': 'D'},
      {'text': 'Komunikator handal saat negosiasi', 'type': 'I'},
      {'text': 'Pendengar tulus bagi pelanggan', 'type': 'S'},
      {'text': 'Menyukai pemecahan rumus matematika', 'type': 'C'},
    ],
    [
      {'text': 'Mendominasi jalannya rapat penting', 'type': 'D'},
      {'text': 'Suka menginspirasi visi bersama', 'type': 'I'},
      {'text': 'Menyukai kestabilan jenjang karir', 'type': 'S'},
      {'text': 'Menyusun berkas arsip secara rapi', 'type': 'C'},
    ],
    [
      {'text': 'Berani menanggung resiko kegagalan', 'type': 'D'},
      {'text': 'Pintar melobi pihak luar', 'type': 'I'},
      {'text': 'Suka bekerja secara kooperatif', 'type': 'S'},
      {'text': 'Kritis terhadap data yang salah', 'type': 'C'},
    ],
    [
      {'text': 'Mandiri mengejar target harian', 'type': 'D'},
      {'text': 'Mudah memaafkan kesalahan tim', 'type': 'I'},
      {'text': 'Menyukai rutinitas operasional', 'type': 'S'},
      {'text': 'Mematuhi jadwal laporan keuangan', 'type': 'C'},
    ]
  ];

  void _selectOption(String type, int optionIndex) {
    setState(() {
      if (!_answers.containsKey(_currentStep)) {
        _answers[_currentStep] = {};
      }
      
      if (type == 'most') {
        if (_answers[_currentStep]?['least'] == optionIndex) {
          _answers[_currentStep]?.remove('least');
        }
        _answers[_currentStep]?['most'] = optionIndex;
      } else {
        if (_answers[_currentStep]?['most'] == optionIndex) {
          _answers[_currentStep]?.remove('most');
        }
        _answers[_currentStep]?['least'] = optionIndex;
      }
    });
  }

  Future<void> _submitDiscTest() async {
    setState(() {
      _isLoading = true;
    });

    // Calculate D, I, S, C scores
    int dScore = 0;
    int iScore = 0;
    int sScore = 0;
    int cScore = 0;

    _answers.forEach((qIdx, ans) {
      final mostIdx = ans['most'];
      final leastIdx = ans['least'];

      if (mostIdx != null) {
        final type = _questions[qIdx][mostIdx]['type'];
        if (type == 'D') dScore += 2;
        if (type == 'I') iScore += 2;
        if (type == 'S') sScore += 2;
        if (type == 'C') cScore += 2;
      }

      if (leastIdx != null) {
        final type = _questions[qIdx][leastIdx]['type'];
        if (type == 'D') dScore -= 1;
        if (type == 'I') iScore -= 1;
        if (type == 'S') sScore -= 1;
        if (type == 'C') cScore -= 1;
      }
    });

    // Make scores non-negative
    dScore = dScore < 0 ? 0 : dScore;
    iScore = iScore < 0 ? 0 : iScore;
    sScore = sScore < 0 ? 0 : sScore;
    cScore = cScore < 0 ? 0 : cScore;

    final total = dScore + iScore + sScore + cScore;
    double dPct = total > 0 ? (dScore / total * 100) : 25.0;
    double iPct = total > 0 ? (iScore / total * 100) : 25.0;
    double sPct = total > 0 ? (sScore / total * 100) : 25.0;
    double cPct = total > 0 ? (cScore / total * 100) : 25.0;

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final payload = {
      'employee_id': auth.profile?.id ?? 'EMP-MOCK',
      'full_name': auth.profile?.fullName ?? 'Karyawan',
      'd_score': dPct.round(),
      'i_score': iPct.round(),
      's_score': sPct.round(),
      'c_score': cPct.round(),
      'date': DateTime.now().toIso8601String().substring(0, 10),
    };

    try {
      final res = await ApiClient.post('disc-results', payload, token: auth.token);
      if (res.statusCode == 200) {
        // Save test local cache so dashboard can show it
        auth.saveDiscResultLocally(payload);
        
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: const Color(0xFF393E46),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('DISC Selesai!', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold)),
            content: Text(
              'Profil Kepribadian Anda:\n'
              '• Dominance (D): ${dPct.round()}%\n'
              '• Influence (I): ${iPct.round()}%\n'
              '• Steadiness (S): ${sPct.round()}%\n'
              '• Compliance (C): ${cPct.round()}%\n\n'
              'Hasil tes Anda telah berhasil dikirim ke Web Owner Portal.',
              style: const TextStyle(color: Color(0x8DEEEEEE), height: 1.5),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context); // Close dialog
                  Navigator.pop(context); // Exit test screen
                },
                child: const Text('OK', style: TextStyle(color: Color(0xFF00ADB5), fontWeight: FontWeight.bold)),
              )
            ],
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Gagal menyimpan hasil DISC ke server.')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gangguan koneksi ke server.')),
      );
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    const darkBg = Color(0xFF222831);
    const cardBg = Color(0xFF393E46);
    const accentColor = Color(0xFF00ADB5);
    const textMain = Color(0xFFEEEEEE);
    const textMuted = Color(0x8DEEEEEE);

    final currentQuestion = _questions[_currentStep];
    final currentAnswer = _answers[_currentStep] ?? {};
    final isStepCompleted = currentAnswer.containsKey('most') && currentAnswer.containsKey('most');

    return Scaffold(
      backgroundColor: darkBg,
      appBar: AppBar(
        backgroundColor: darkBg,
        elevation: 0,
        title: Text(
          'TES PSIKOGRAM DISC (${_currentStep + 1} / 28)',
          style: const TextStyle(color: textMain, fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 1),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: textMain),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: accentColor))
          : Column(
              children: [
                // Progress Bar
                LinearProgressIndicator(
                  value: (_currentStep + 1) / 28.0,
                  backgroundColor: cardBg,
                  color: accentColor,
                  minHeight: 6,
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Pilih 1 Sifat Paling Sesuai (🟢 M) dan 1 Sifat Paling Tidak Sesuai (🔴 L) bagi diri Anda:',
                          style: TextStyle(color: textMuted, fontSize: 13, height: 1.5),
                        ),
                        const SizedBox(height: 24),
                        ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: 4,
                          itemBuilder: (context, idx) {
                            final opt = currentQuestion[idx];
                            final isMost = currentAnswer['most'] == idx;
                            final isLeast = currentAnswer['least'] == idx;

                            return Container(
                              margin: const EdgeInsets.only(bottom: 16),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: cardBg,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isMost
                                      ? Colors.green.withOpacity(0.5)
                                      : isLeast
                                          ? Colors.red.withOpacity(0.5)
                                          : Colors.transparent,
                                  width: 1.5,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      opt['text'],
                                      style: const TextStyle(color: textMain, fontSize: 13, fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  // Button Most
                                  InkWell(
                                    onTap: () => _selectOption('most', idx),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: isMost ? Colors.green : Colors.transparent,
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(color: Colors.green),
                                      ),
                                      child: Text(
                                        '🟢 M',
                                        style: TextStyle(
                                          color: isMost ? Colors.white : Colors.green,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  // Button Least
                                  InkWell(
                                    onTap: () => _selectOption('least', idx),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: isLeast ? Colors.red : Colors.transparent,
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(color: Colors.red),
                                      ),
                                      child: Text(
                                        '🔴 L',
                                        style: TextStyle(
                                          color: isLeast ? Colors.white : Colors.red,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ),
                
                // Bottom Buttons
                Container(
                  padding: const EdgeInsets.all(20),
                  color: cardBg,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (_currentStep > 0)
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(backgroundColor: darkBg),
                          onPressed: () {
                            setState(() {
                              _currentStep--;
                            });
                          },
                          child: const Text('KEMBALI', style: TextStyle(color: textMain)),
                        )
                      else
                        const SizedBox(),
                      
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isStepCompleted ? accentColor : Colors.grey[800],
                        ),
                        onPressed: !isStepCompleted
                            ? null
                            : () {
                                if (_currentStep < 27) {
                                  setState(() {
                                    _currentStep++;
                                  });
                                } else {
                                  _submitDiscTest();
                                }
                              },
                        child: Text(
                          _currentStep == 27 ? 'SUBMIT TES' : 'LANJUT',
                          style: const TextStyle(color: textMain, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
