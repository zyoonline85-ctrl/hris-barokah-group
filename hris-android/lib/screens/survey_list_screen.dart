import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../models/models.dart';

class SurveyListScreen extends StatefulWidget {
  const SurveyListScreen({Key? key}) : super(key: key);

  @override
  State<SurveyListScreen> createState() => _SurveyListScreenState();
}

class _SurveyListScreenState extends State<SurveyListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AuthProvider>(context, listen: false).fetchSurveys();
    });
  }

  Future<void> _onRefresh() async {
    await Provider.of<AuthProvider>(context, listen: false).fetchSurveys();
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final themeColor = const Color(0xFFEEEEEE); // Krem
    final cardBg = const Color(0xFF393E46); // Coklat gelap pekat

    return Scaffold(
      backgroundColor: const Color(0xFF222831), // Pure black/dark bg
      appBar: AppBar(
        backgroundColor: const Color(0xFF393E46),
        elevation: 0,
        iconTheme: IconThemeData(color: themeColor),
        title: Text(
          'Survey Karyawan',
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
        color: const Color(0xFF00ADB5),
        backgroundColor: cardBg,
        child: auth.isLoading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF00ADB5)))
            : auth.surveys.isEmpty
                ? _buildEmptyState(themeColor)
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: auth.surveys.length,
                    itemBuilder: (context, index) {
                      final survey = auth.surveys[index];
                      return _buildSurveyCard(survey, themeColor, cardBg);
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
                'Tidak ada survey aktif saat ini.',
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

  Widget _buildSurveyCard(
    SurveyRecord survey,
    Color themeColor,
    Color cardBg,
  ) {
    return Card(
      color: cardBg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: survey.hasCompleted ? themeColor.withOpacity(0.2) : const Color(0x1AEEEEEE),
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
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF00ADB5),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '10 Pertanyaan',
                    style: TextStyle(
                      color: themeColor,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: survey.hasCompleted
                        ? themeColor.withOpacity(0.15)
                        : const Color(0xFF2ECC71).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: survey.hasCompleted
                          ? themeColor.withOpacity(0.4)
                          : const Color(0xFF2ECC71).withOpacity(0.4),
                      width: 1,
                    ),
                  ),
                  child: Text(
                    survey.hasCompleted ? 'SELESAI' : 'AKTIF',
                    style: TextStyle(
                      color: survey.hasCompleted ? themeColor : const Color(0xFF2ECC71),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              survey.title,
              style: TextStyle(
                color: themeColor,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            const Divider(color: Color(0x1AEEEEEE), height: 1),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.calendar_today_rounded, size: 14, color: themeColor.withOpacity(0.7)),
                const SizedBox(width: 6),
                Text(
                  'Periode: ${survey.startDate} s/d ${survey.endDate}',
                  style: TextStyle(
                    color: themeColor.withOpacity(0.8),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (survey.hasCompleted) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: themeColor.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: themeColor.withOpacity(0.1), width: 1),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.check_circle, color: Color(0xFF2ECC71), size: 16),
                    SizedBox(width: 8),
                    Text(
                      'Terimakasih! Anda telah mengisi survey ini.',
                      style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
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
                        builder: (context) => FillSurveyScreen(survey: survey),
                      ),
                    ).then((value) {
                      if (value == true) {
                        Provider.of<AuthProvider>(context, listen: false).fetchSurveys();
                      }
                    });
                  },
                  child: Text(
                    'MULAI ISI SURVEY',
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

class FillSurveyScreen extends StatefulWidget {
  final SurveyRecord survey;
  const FillSurveyScreen({Key? key, required this.survey}) : super(key: key);

  @override
  State<FillSurveyScreen> createState() => _FillSurveyScreenState();
}

class _FillSurveyScreenState extends State<FillSurveyScreen> {
  int _currentIndex = 0;
  final Map<String, String> _answers = {};
  bool _isSubmitting = false;

  void _selectOption(String questionId, String optionKey) {
    setState(() {
      _answers[questionId] = optionKey;
    });
  }

  Future<void> _submitSurvey() async {
    if (_answers.length < widget.survey.questions.length) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Harap jawab semua pertanyaan terlebih dahulu.')),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.submitSurveyResponse(widget.survey.id, _answers);

    setState(() {
      _isSubmitting = false;
    });

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Jawaban survey berhasil dikirim.')),
      );
      Navigator.pop(context, true);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gagal mengirim jawaban survey.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeColor = const Color(0xFFEEEEEE);
    final cardBg = const Color(0xFF393E46);
    final activeQ = widget.survey.questions[_currentIndex];
    final selectedAns = _answers[activeQ.id];

    return Scaffold(
      backgroundColor: const Color(0xFF222831),
      appBar: AppBar(
        backgroundColor: const Color(0xFF393E46),
        elevation: 0,
        iconTheme: IconThemeData(color: themeColor),
        title: Text(
          'Pertanyaan ${_currentIndex + 1}/${widget.survey.questions.length}',
          style: TextStyle(color: themeColor, fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      body: _isSubmitting
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00ADB5)))
          : Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Progress Bar
                  LinearProgressIndicator(
                    value: (_currentIndex + 1) / widget.survey.questions.length,
                    backgroundColor: cardBg,
                    valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF00ADB5)),
                    minHeight: 6,
                    borderRadius: BorderRadius.circular(3),
                  ),
                  const SizedBox(height: 24),

                  // Question Box
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFEEEEEE).withOpacity(0.05)),
                    ),
                    child: Text(
                      activeQ.text,
                      style: TextStyle(
                        color: themeColor,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        height: 1.4,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Answers List
                  Expanded(
                    child: ListView(
                      children: ['a', 'b', 'c', 'd'].map((key) {
                        final optionText = activeQ.options[key] ?? '';
                        if (optionText.isEmpty) return const SizedBox.shrink();

                        final isSelected = selectedAns == key;

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: InkWell(
                            onTap: () => _selectOption(activeQ.id, key),
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
                              decoration: BoxDecoration(
                                color: isSelected ? const Color(0xFF00ADB5).withOpacity(0.15) : cardBg,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isSelected
                                      ? const Color(0xFF00ADB5)
                                      : const Color(0xFFEEEEEE).withOpacity(0.05),
                                  width: 1.5,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 24,
                                    height: 24,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: isSelected ? const Color(0xFF00ADB5) : themeColor.withOpacity(0.4),
                                        width: 2,
                                      ),
                                      color: isSelected ? const Color(0xFF00ADB5) : Colors.transparent,
                                    ),
                                    child: isSelected
                                        ? const Icon(Icons.check, size: 14, color: Colors.white)
                                        : Center(
                                            child: Text(
                                              key.toUpperCase(),
                                              style: TextStyle(
                                                color: themeColor.withOpacity(0.6),
                                                fontSize: 10,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      optionText,
                                      style: TextStyle(
                                        color: isSelected ? Colors.white : themeColor,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                  // Bottom Buttons
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (_currentIndex > 0)
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: cardBg,
                            foregroundColor: themeColor,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          onPressed: () {
                            setState(() {
                              _currentIndex--;
                            });
                          },
                          child: const Text('Kembali'),
                        )
                      else
                        const SizedBox.shrink(),
                      
                      const Spacer(),

                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF00ADB5),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: selectedAns == null
                            ? null
                            : () {
                                if (_currentIndex < widget.survey.questions.length - 1) {
                                  setState(() {
                                    _currentIndex++;
                                  });
                                } else {
                                  _submitSurvey();
                                }
                              },
                        child: Text(_currentIndex == widget.survey.questions.length - 1
                            ? 'Kirim Survey'
                            : 'Selanjutnya'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
    );
  }
}
