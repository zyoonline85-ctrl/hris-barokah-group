import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import '../providers/auth_provider.dart';
import '../models/models.dart';

class QuizScreen extends StatefulWidget {
  final QuizRecord quiz;
  const QuizScreen({Key? key, required this.quiz}) : super(key: key);

  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> {
  int _currentIndex = 0;
  late List<String> _answers;
  late int _secondsRemaining;
  Timer? _timer;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _answers = List.filled(widget.quiz.soal.length, '');
    _secondsRemaining = widget.quiz.durasiMenit * 60;
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsRemaining > 0) {
        setState(() {
          _secondsRemaining--;
        });
      } else {
        _timer?.cancel();
        _autoSubmit();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _formatTime(int totalSeconds) {
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  void _autoSubmit() async {
    if (_isSubmitting) return;
    setState(() {
      _isSubmitting = true;
    });

    // Vibrate to alert user
    HapticFeedback.vibrate();
    Future.delayed(const Duration(milliseconds: 300), () => HapticFeedback.vibrate());

    // Show locked auto-submit message dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => WillPopScope(
        onWillPop: () async => false,
        child: AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFFE74C3C), width: 2),
          ),
          title: const Row(
            children: [
              Icon(Icons.timer_off_outlined, color: Color(0xFFE74C3C)),
              SizedBox(width: 8),
              Text(
                'WAKTU HABIS!',
                style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: const Text(
            'Waktu pengerjaan kuis telah habis. Jawaban Anda yang terisi saat ini akan dikirimkan otomatis ke server.',
            style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 13, height: 1.4),
          ),
        ),
      ),
    );

    // Call API submit
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.submitQuizAttempt(widget.quiz.id, _answers);

    // Wait 2 seconds to let user read the dialog, then navigate back
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) {
      Navigator.pop(context); // Pop dialog
      Navigator.pop(context); // Pop QuizScreen
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success ? 'Kuis dikirim otomatis!' : 'Kuis selesai dikirim otomatis.',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          backgroundColor: const Color(0xFF00ADB5),
        ),
      );
    }
  }

  void _confirmSubmit() {
    // Check if any answers are empty
    final unanswredCount = _answers.where((a) => a.isEmpty).length;
    final warningText = unanswredCount > 0 
        ? '\n⚠️ PERINGATAN: Ada $unanswredCount soal yang belum Anda jawab!' 
        : '';

    // First Confirmation Dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text(
            'Konfirmasi Kirim',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          content: Text(
            'Apakah Anda yakin ingin mengakhiri kuis dan mengirimkan jawaban Anda sekarang?$warningText',
            style: const TextStyle(color: Color(0x8DEEEEEE), fontSize: 14, height: 1.4),
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
                        Navigator.pop(context); // Pop first dialog
                        _doubleConfirmSubmit(); // Open second dialog
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

  void _doubleConfirmSubmit() {
    // Second Confirmation Dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFFEEEEEE), width: 1),
          ),
          title: const Text(
            '⚠️ PERINGATAN AKHIR',
            style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
          ),
          content: const Text(
            'Tindakan ini tidak dapat dibatalkan. Jawaban Anda akan langsung dikunci dan dinilai oleh server. Lanjutkan?',
            style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 14, height: 1.4),
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
              child: Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFE74C3C), // Merah penegasan
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () {
                        Navigator.pop(context); // Pop dialog
                        _executeSubmit();
                      },
                      child: const Text('KIRIM', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold)),
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

  void _executeSubmit() async {
    if (_isSubmitting) return;
    setState(() {
      _isSubmitting = true;
    });

    // Tampilkan fullscreen loading overlay spinner
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return WillPopScope(
          onWillPop: () async => false,
          child: Center(
            child: Material(
              type: MaterialType.transparency,
              child: Container(
                color: Colors.black.withOpacity(0.7),
                width: double.infinity,
                height: double.infinity,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFEEEEEE)),
                    ),
                    SizedBox(height: 16),
                    Text(
                      'Sedang menyelaraskan data dengan server pusat...',
                      style: TextStyle(
                        color: Color(0xFFEEEEEE),
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.submitQuizAttempt(widget.quiz.id, _answers);

    if (mounted) {
      Navigator.pop(context); // Tutup fullscreen loading spinner
      setState(() {
        _isSubmitting = false;
      });
      Navigator.pop(context); // Pop QuizScreen
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success ? 'Jawaban kuis berhasil dikirim!' : 'Gagal mengirim jawaban kuis.',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          backgroundColor: success ? const Color(0xFF2ECC71) : const Color(0xFFE74C3C),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeColor = const Color(0xFFEEEEEE); // Krem
    final cardBg = const Color(0xFF393E46); // Coklat gelap
    final accentColor = const Color(0xFF00ADB5); // Coklat sedang

    final question = widget.quiz.soal[_currentIndex];
    final progress = (_currentIndex + 1) / widget.quiz.soal.length;

    final isTimerWarning = _secondsRemaining < 120; // < 2 menit

    return WillPopScope(
      onWillPop: () async {
        // Prevent accidental back press
        final confirm = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: cardBg,
            title: const Text('Keluar Kuis?', style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold)),
            content: const Text('Jika Anda keluar, pengerjaan kuis Anda saat ini akan hilang dan nilai tidak tercatat. Yakin keluar?', style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 13)),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: Text('BATAL', style: TextStyle(color: themeColor))),
              TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('KELUAR', style: TextStyle(color: Color(0xFFE74C3C)))),
            ],
          ),
        );
        return confirm ?? false;
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF222831), // Pure black
        appBar: AppBar(
          backgroundColor: cardBg,
          elevation: 0,
          iconTheme: IconThemeData(color: themeColor),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.quiz.judul,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: themeColor,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                widget.quiz.jenisKuis,
                style: TextStyle(
                  color: themeColor.withOpacity(0.6),
                  fontSize: 11,
                ),
              ),
            ],
          ),
          actions: [
            // Live Countdown Timer
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isTimerWarning ? const Color(0xFFE74C3C).withOpacity(0.15) : accentColor,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isTimerWarning ? const Color(0xFFE74C3C) : themeColor.withOpacity(0.3),
                  width: 1,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.timer_outlined,
                    size: 14,
                    color: isTimerWarning ? const Color(0xFFE74C3C) : themeColor,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _formatTime(_secondsRemaining),
                    style: TextStyle(
                      color: isTimerWarning ? const Color(0xFFE74C3C) : themeColor,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
            )
          ],
        ),
        body: _isSubmitting
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF00ADB5)))
            : Column(
                children: [
                  // Progress Bar
                  LinearProgressIndicator(
                    value: progress,
                    backgroundColor: cardBg,
                    valueColor: AlwaysStoppedAnimation<Color>(themeColor),
                    minHeight: 4,
                  ),
                  const SizedBox(height: 16),
                  // Progress Status
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Pertanyaan ${_currentIndex + 1} dari ${widget.quiz.soal.length}',
                          style: TextStyle(
                            color: themeColor.withOpacity(0.8),
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: _answers[_currentIndex].isNotEmpty ? const Color(0xFF2ECC71).withOpacity(0.15) : accentColor,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            _answers[_currentIndex].isNotEmpty ? 'TERJAWAB' : 'BELUM DIJAWAB',
                            style: TextStyle(
                              color: _answers[_currentIndex].isNotEmpty ? const Color(0xFF2ECC71) : themeColor.withOpacity(0.6),
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Question & Options Container
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Question Card
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: cardBg,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: themeColor.withOpacity(0.15), width: 1),
                            ),
                            child: Text(
                              question.tanya,
                              style: TextStyle(
                                color: themeColor,
                                fontSize: 16,
                                height: 1.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          // Options List
                          _buildOptionItem('A', question.opsiA, themeColor, cardBg, accentColor),
                          const SizedBox(height: 12),
                          _buildOptionItem('B', question.opsiB, themeColor, cardBg, accentColor),
                          const SizedBox(height: 12),
                          _buildOptionItem('C', question.opsiC, themeColor, cardBg, accentColor),
                          const SizedBox(height: 12),
                          _buildOptionItem('D', question.opsiD, themeColor, cardBg, accentColor),
                        ],
                      ),
                    ),
                  ),
                  // Navigation Bar
                  Container(
                    padding: const EdgeInsets.all(16),
                    color: cardBg,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Button Back
                        SizedBox(
                          width: 100,
                          height: 44,
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: _currentIndex > 0 ? themeColor : Color(0x1AEEEEEE)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            onPressed: _currentIndex > 0
                                ? () {
                                    setState(() {
                                      _currentIndex--;
                                    });
                                  }
                                : null,
                            child: Text(
                              'KEMBALI',
                              style: TextStyle(
                                color: _currentIndex > 0 ? themeColor : Color(0x1AEEEEEE),
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ),
                        // Button Next or Submit
                        SizedBox(
                          width: 130,
                          height: 44,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _currentIndex == widget.quiz.soal.length - 1
                                  ? const Color(0xFF2ECC71) // Hijau untuk submit
                                  : themeColor,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            onPressed: () {
                              if (_currentIndex < widget.quiz.soal.length - 1) {
                                setState(() {
                                  _currentIndex++;
                                });
                              } else {
                                _confirmSubmit();
                              }
                            },
                            child: Text(
                              _currentIndex == widget.quiz.soal.length - 1 ? 'KIRIM JAWABAN' : 'LANJUT',
                              style: TextStyle(
                                color: _currentIndex == widget.quiz.soal.length - 1 ? Color(0xFFEEEEEE) : Colors.black,
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildOptionItem(String key, String text, Color themeColor, Color cardBg, Color accentColor) {
    final isSelected = _answers[_currentIndex] == key;

    return GestureDetector(
      onTap: () {
        setState(() {
          _answers[_currentIndex] = key;
        });
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isSelected ? themeColor.withOpacity(0.12) : cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? themeColor : Color(0x1AEEEEEE),
            width: isSelected ? 2.0 : 1.0,
          ),
        ),
        child: Row(
          children: [
            // Option Badge (A, B, C, D)
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: isSelected ? themeColor : accentColor,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(
                key,
                style: TextStyle(
                  color: isSelected ? Colors.black : themeColor,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
            const SizedBox(width: 14),
            // Option Text
            Expanded(
              child: Text(
                text,
                style: TextStyle(
                  color: isSelected ? themeColor : Color(0x8DEEEEEE),
                  fontSize: 14,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
