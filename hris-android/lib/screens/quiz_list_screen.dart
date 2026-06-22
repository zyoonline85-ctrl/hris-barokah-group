import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../models/models.dart';
import 'quiz_screen.dart';

class QuizListScreen extends StatefulWidget {
  const QuizListScreen({Key? key}) : super(key: key);

  @override
  State<QuizListScreen> createState() => _QuizListScreenState();
}

class _QuizListScreenState extends State<QuizListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AuthProvider>(context, listen: false).fetchQuizzes();
      Provider.of<AuthProvider>(context, listen: false).fetchQuizAttempts();
    });
  }

  Future<void> _onRefresh() async {
    await Provider.of<AuthProvider>(context, listen: false).fetchQuizzes();
    await Provider.of<AuthProvider>(context, listen: false).fetchQuizAttempts();
  }

  bool _isQuizExpired(QuizRecord quiz) {
    if (quiz.tanggalAkhir == null || quiz.tanggalAkhir!.isEmpty) return false;
    try {
      final now = DateTime.now();
      final todayStr = DateFormat('yyyy-MM-dd').format(now);
      final today = DateTime.parse(todayStr);
      final limitDate = DateTime.parse(quiz.tanggalAkhir!);
      return today.isAfter(limitDate);
    } catch (_) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final themeColor = const Color(0xFFEEEEEE); // Krem
    final cardBg = const Color(0xFF393E46); // Coklat gelap pekat

    return Scaffold(
      backgroundColor: const Color(0xFF222831), // Pure black
      appBar: AppBar(
        backgroundColor: const Color(0xFF393E46),
        elevation: 0,
        iconTheme: IconThemeData(color: themeColor),
        title: Text(
          'Kuis Kompetensi',
          style: TextStyle(
            color: themeColor,
            fontSize: 18,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.5,
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _onRefresh,
        color: themeColor,
        backgroundColor: cardBg,
        child: auth.isLoading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF00ADB5)))
            : auth.quizzes.isEmpty
                ? _buildEmptyState(themeColor)
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: auth.quizzes.length,
                    itemBuilder: (context, index) {
                      final quiz = auth.quizzes[index];
                      // Cari apakah ada attempt untuk kuis ini
                      final attempt = auth.quizAttempts.firstWhere(
                        (att) => att.quizId == quiz.id,
                        orElse: () => QuizAttemptRecord(
                          id: 0,
                          employeeId: 0,
                          quizId: 0,
                          nilai: 0,
                          status: '',
                          tanggal: '',
                        ),
                      );

                      final isCompleted = attempt.id != 0;
                      final isExpired = _isQuizExpired(quiz);

                      return _buildQuizCard(quiz, isCompleted, isExpired, attempt, themeColor, cardBg);
                    },
                  ),
      ),
    );
  }

  Widget _buildEmptyState(Color themeColor) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.25),
        Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.assignment_outlined,
                size: 64,
                color: themeColor.withOpacity(0.5),
              ),
              const SizedBox(height: 16),
              Text(
                'Tidak ada kuis aktif saat ini.',
                style: TextStyle(
                  color: themeColor,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Tarik ke bawah untuk menyegarkan halaman',
                style: TextStyle(
                  color: themeColor.withOpacity(0.6),
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildQuizCard(
    QuizRecord quiz,
    bool isCompleted,
    bool isExpired,
    QuizAttemptRecord attempt,
    Color themeColor,
    Color cardBg,
  ) {
    String statusText = 'AKTIF';
    Color statusColor = const Color(0xFF2ECC71); // Hijau

    if (isCompleted) {
      statusText = 'SELESAI';
      statusColor = themeColor;
    } else if (isExpired) {
      statusText = 'KEDALUWARSA';
      statusColor = const Color(0xFFE74C3C); // Merah
    }

    return Card(
      color: cardBg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: isCompleted ? themeColor.withOpacity(0.2) : Color(0x1AEEEEEE),
          width: 1.5,
        ),
      ),
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Badge Jenis Kuis
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF00ADB5),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    quiz.jenisKuis,
                    style: TextStyle(
                      color: themeColor,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                // Badge Status
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: statusColor.withOpacity(0.4), width: 1),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              quiz.judul,
              style: TextStyle(
                color: themeColor,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            if (quiz.deskripsi != null && quiz.deskripsi!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                quiz.deskripsi!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0x8DEEEEEE),
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            ],
            const SizedBox(height: 16),
            const Divider(color: Color(0x1AEEEEEE), height: 1),
            const SizedBox(height: 12),
            // Info Row
            Row(
              children: [
                Icon(Icons.access_time_rounded, size: 14, color: themeColor.withOpacity(0.7)),
                const SizedBox(width: 6),
                Text(
                  'Waktu: ${quiz.durasiMenit} Menit',
                  style: TextStyle(
                    color: themeColor.withOpacity(0.8),
                    fontSize: 12,
                  ),
                ),
                const Spacer(),
                Icon(Icons.calendar_today_rounded, size: 14, color: themeColor.withOpacity(0.7)),
                const SizedBox(width: 6),
                Text(
                  'Batas: ${quiz.tanggalAkhir ?? '-'}',
                  style: TextStyle(
                    color: themeColor.withOpacity(0.8),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Action Button
            if (isCompleted) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: themeColor.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: themeColor.withOpacity(0.1), width: 1),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      attempt.status == 'lulus' ? Icons.check_circle : Icons.info_outline,
                      color: attempt.status == 'lulus' ? const Color(0xFF2ECC71) : themeColor,
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      quiz.jenisKuis == 'Matriks Pilihan'
                          ? 'Kuis Selesai Dikerjakan (Survei Matriks)'
                          : 'Nilai: ${attempt.nilai.toInt()} / Status: ${attempt.status.toUpperCase()}',
                      style: TextStyle(
                        color: themeColor,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ] else if (isExpired) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFE74C3C).withOpacity(0.05),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFE74C3C).withOpacity(0.2), width: 1),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.lock_outline, color: Color(0xFFE74C3C), size: 16),
                    SizedBox(width: 8),
                    Text(
                      'Kuis ditutup (Melewati batas waktu)',
                      style: TextStyle(
                        color: Color(0xFFE74C3C),
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              SizedBox(
                width: double.infinity,
                height: 40,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00ADB5),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                      side: BorderSide(color: themeColor, width: 1),
                    ),
                  ),
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => QuizScreen(quiz: quiz),
                      ),
                    );
                  },
                  child: Text(
                    'MULAI KUIS',
                    style: TextStyle(
                      color: themeColor,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      letterSpacing: 1,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
