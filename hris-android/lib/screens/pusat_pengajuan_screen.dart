import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../models/models.dart';

class PusatPengajuanScreen extends StatefulWidget {
  const PusatPengajuanScreen({Key? key}) : super(key: key);

  @override
  State<PusatPengajuanScreen> createState() => _PusatPengajuanScreenState();
}

class _PusatPengajuanScreenState extends State<PusatPengajuanScreen> {
  String _selectedType = 'cuti';
  DateTime? _startDate;
  DateTime? _endDate;
  TimeOfDay? _halfDayClockOutTime;
  final _amountController = TextEditingController();
  final _reasonController = TextEditingController();

  final currencyFormatter = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp', decimalDigits: 0);

  @override
  void dispose() {
    _amountController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  // --- Helper Methods to parse policies ---

  int getCutoffStartDayFromPolicies(List<dynamic> policies, String? employeeOutlet) {
    try {
      final policy = policies.firstWhere(
        (p) {
          final isNameMatch = p['nama_aturan'] == 'Periode Cut-Off & Tanggal Gajian' ||
                              p['nama_kebijakan'] == 'Periode Cut-Off & Tanggal Gajian';
          if (!isNameMatch) return false;
          
          final status = p['status']?.toString().toLowerCase();
          if (status != 'active' && status != 'aktif') return false;

          final onlySelected = p['hanya_outlet_terpilih'] == 1 || p['hanya_outlet_terpilih'] == true;
          if (!onlySelected) return true;

          var berlakuDi = p['berlaku_di'] ?? p['outlets'];
          List<String> outlets = [];
          if (berlakuDi is List) {
            outlets = berlakuDi.map((e) => e.toString().toLowerCase().trim()).toList();
          } else if (berlakuDi is String) {
            try {
              final decoded = jsonDecode(berlakuDi);
              if (decoded is List) {
                outlets = decoded.map((e) => e.toString().toLowerCase().trim()).toList();
              }
            } catch (_) {
              outlets = berlakuDi.split(',').map((e) => e.toLowerCase().trim()).toList();
            }
          }
          
          final outletLower = employeeOutlet?.toLowerCase().trim() ?? '';
          return outlets.contains(outletLower);
        },
        orElse: () => null,
      );

      if (policy != null) {
        final desc = policy['deskripsi'] ?? policy['nilai'] ?? '';
        final match = RegExp(r'Periode\s+Cut-Off:\s*(\d+)\s*-\s*(\d+)', caseSensitive: false)
            .firstMatch(desc.toString());
        if (match != null) {
          return int.parse(match.group(1)!);
        }
      }
    } catch (e) {
      print('Error parsing cutoff day from policies: $e');
    }
    return 23; // default fallback
  }

  int getMaxLeaveLimitFromPolicies(List<dynamic> policies) {
    try {
      final policy = policies.firstWhere(
        (p) => (p['status'] == 'ACTIVE' || p['status'] == 'aktif') &&
               (p['nama_aturan'] == 'Batasan Pengajuan Libur & Denda Operasional' ||
                p['nama_kebijakan'] == 'Batasan Pengajuan Libur & Denda Operasional'),
        orElse: () => null,
      );
      if (policy != null) {
        final desc = policy['deskripsi'] ?? policy['nilai'] ?? '';
        final match = RegExp(r'Maksimal pengajuan libur adalah\s*(\d+)\s*hari', caseSensitive: false)
            .firstMatch(desc.toString());
        if (match != null) {
          return int.parse(match.group(1)!);
        }
      }
    } catch (e) {
      print('Error parsing max leave limit from policies: $e');
    }
    return 2; // default fallback
  }

  Map<String, DateTime> getActiveCutoffPeriod(int startDay, DateTime today) {
    int year = today.year;
    int month = today.month;
    
    if (startDay == 1) {
      DateTime start = DateTime(year, month, 1);
      DateTime end = DateTime(year, month + 1, 0);
      return {'start': start, 'end': end};
    } else {
      if (today.day >= startDay) {
        DateTime start = DateTime(year, month, startDay);
        DateTime end = DateTime(year, month + 1, startDay - 1);
        return {'start': start, 'end': end};
      } else {
        DateTime start = DateTime(year, month - 1, startDay);
        DateTime end = DateTime(year, month, startDay - 1);
        return {'start': start, 'end': end};
      }
    }
  }

  int getOverlappingDays(DateTime start1, DateTime end1, DateTime start2, DateTime end2) {
    DateTime maxStart = start1.isAfter(start2) ? start1 : start2;
    DateTime minEnd = end1.isBefore(end2) ? end1 : end2;
    if (maxStart.isAfter(minEnd)) {
      return 0;
    }
    return minEnd.difference(maxStart).inDays + 1;
  }

  bool _validateKasbon(double amount, double basicSalary) {
    final maxSalaryLimit = basicSalary * 0.5;
    final limit = maxSalaryLimit < 500000.0 ? maxSalaryLimit : 500000.0;
    return amount <= limit;
  }

  Future<void> _selectDate(BuildContext context, bool isStart) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2025),
      lastDate: DateTime(2030),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFFEEEEEE),
              onPrimary: Colors.black,
              surface: Color(0xFF393E46),
              onSurface: Color(0xFFEEEEEE),
            ),
            dialogBackgroundColor: const Color(0xFF393E46),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          if (_endDate == null || _endDate!.isBefore(picked)) {
            _endDate = picked;
          }
        } else {
          _endDate = picked;
        }
      });
    }
  }

  Future<void> _selectTime(BuildContext context) async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 17, minute: 0),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFFEEEEEE),
              onPrimary: Colors.black,
              surface: Color(0xFF393E46),
              onSurface: Color(0xFFEEEEEE),
            ),
            dialogBackgroundColor: const Color(0xFF393E46),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _halfDayClockOutTime = picked;
      });
    }
  }

  void _onSubmit(AuthProvider auth) {
    if (_selectedType == 'kasbon') {
      final text = _amountController.text.trim();
      final double? amount = double.tryParse(text);
      if (amount == null || amount <= 0) {
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(backgroundColor: Colors.red, content: Text('❌ Silakan masukkan nominal kasbon yang valid')),
        );
        return;
      }
      final basicSalary = auth.profile?.basicSalary ?? 0.0;
      if (!_validateKasbon(amount, basicSalary)) {
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.red,
            content: Text('❌ Gagal: Pengajuan kasbon Anda melanggar ketentuan limit batas aman perusahaan!'),
          ),
        );
        return;
      }
    }
    
    if (_selectedType == 'setengah_hari') {
      if (_startDate == null || _halfDayClockOutTime == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('❌ Silakan lengkapi tanggal dan jam pulang')),
        );
        return;
      }
    } else {
      if (_startDate == null || (_selectedType != 'kasbon' && _endDate == null)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('❌ Silakan lengkapi tanggal pengajuan')),
        );
        return;
      }
    }

    if (_reasonController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('❌ Silakan isi alasan pengajuan')),
      );
      return;
    }

    if (_selectedType == 'cuti' || _selectedType == 'izin' || _selectedType == 'sakit') {
      if (_startDate != null && _endDate != null) {
        final hasWeekendOrPeak = _checkHasWeekendOrPeakDay(_startDate!, _endDate!, auth.peakDays);
        if (hasWeekendOrPeak) {
          _showConsequenceDialog(() {
            _showDoubleConfirmationDialog(auth);
          });
          return;
        }
      }
    }

    _showDoubleConfirmationDialog(auth);
  }

  void _showDoubleConfirmationDialog(AuthProvider auth) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text(
            'Konfirmasi Pengajuan (Tahap 1)',
            style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
          ),
          content: const Text(
            'Apakah Anda yakin ingin mengirim pengajuan ini?',
            style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 14),
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
                        _showFinalConfirmationDialog(auth);
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

  void _showFinalConfirmationDialog(AuthProvider auth) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text(
            'Konfirmasi Final (Tahap 2)',
            style: TextStyle(color: Colors.redAccent, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          content: const Text(
            'Konfirmasi Final: Pastikan nominal/tanggal tidak salah. Kirim sekarang?',
            style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 14),
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
                        _executeSubmit(auth);
                      },
                      child: const Text('KIRIM', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
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

  void _showConsequenceDialog(VoidCallback onOk) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text(
            '⚠️ Peringatan Hari Sibuk',
            style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
          ),
          content: const Text(
            'Apakah kamu siap menerima sanksi berupa potongan sebesar 200 ribu untuk hari sabtu atau minggu atau 250 ribu untuk peak day?',
            style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 14),
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
                        onOk();
                      },
                      child: const Text('OK', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
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
                      child: const Text('CANCEL', style: TextStyle(color: Color(0x8DEEEEEE), fontWeight: FontWeight.bold)),
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

  bool _checkHasWeekendOrPeakDay(DateTime start, DateTime end, List<dynamic> peakDays) {
    try {
      final normalizedStart = DateTime(start.year, start.month, start.day);
      final normalizedEnd = DateTime(end.year, end.month, end.day);
      
      for (int i = 0; i <= normalizedEnd.difference(normalizedStart).inDays; i++) {
        final date = normalizedStart.add(Duration(days: i));
        
        if (date.weekday == DateTime.saturday || date.weekday == DateTime.sunday) {
          return true;
        }
        
        final day = date.day;
        final month = date.month;
        final year = date.year;
        
        for (var p in peakDays) {
          final pTgl = int.tryParse(p['tanggal'].toString()) ?? 0;
          final pBln = int.tryParse(p['bulan'].toString()) ?? 0;
          final pThn = int.tryParse(p['tahun'].toString()) ?? 0;
          
          if (day == pTgl && month == pBln && year == pThn) {
            return true;
          }
        }
      }
    } catch (e) {
      print('Error checking weekend or peak day: $e');
    }
    return false;
  }

  void _executeSubmit(AuthProvider auth) {
    final type = _selectedType;
    final startStr = DateFormat('yyyy-MM-dd').format(_startDate ?? DateTime.now());
    
    String endStr;
    if (_selectedType == 'setengah_hari') {
      endStr = startStr;
    } else if (_selectedType == 'kasbon') {
      endStr = startStr;
    } else {
      endStr = DateFormat('yyyy-MM-dd').format(_endDate ?? DateTime.now());
    }

    String? halfDayClockOut;
    if (_selectedType == 'setengah_hari' && _halfDayClockOutTime != null) {
      final hour = _halfDayClockOutTime!.hour.toString().padLeft(2, '0');
      final minute = _halfDayClockOutTime!.minute.toString().padLeft(2, '0');
      halfDayClockOut = '$hour:$minute';
    }

    double? cashAdvanceAmount;
    if (_selectedType == 'kasbon') {
      cashAdvanceAmount = double.tryParse(_amountController.text.trim());
    }

    auth.submitFormPengajuan(
      type,
      startStr,
      endStr,
      _reasonController.text.trim(),
      halfDayClockOut: halfDayClockOut,
      cashAdvanceAmount: cashAdvanceAmount,
    ).then((_) {
      if (auth.errorMessage != null) {
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: Colors.red, content: Text(auth.errorMessage!)),
        );
      } else if (auth.successMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: const Color(0xFF10B981), content: Text(auth.successMessage!)),
        );
        setState(() {
          _startDate = null;
          _endDate = null;
          _halfDayClockOutTime = null;
          _amountController.clear();
          _reasonController.clear();
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    
    const darkBg = Color(0xFF222831); 
    const cardBg = Color(0xFF393E46); 
    const creamAccent = Color(0xFFEEEEEE); 
    const textMuted = Color(0x8DEEEEEE); 
    const success = Color(0xFF10B981);
    const warning = Color(0xFFF59E0B);

    final cutoffStartDay = getCutoffStartDayFromPolicies(auth.policies, auth.profile?.outlet);
    final activePeriod = getActiveCutoffPeriod(cutoffStartDay, DateTime.now());
    final maxLeaveLimit = getMaxLeaveLimitFromPolicies(auth.policies);

    int takenDays = 0;
    for (var lv in auth.leaveHistory) {
      if (lv.leaveType == 'cuti' && lv.status != 'rejected') {
        try {
          DateTime lvStart = DateTime.parse(lv.startDate);
          DateTime lvEnd = DateTime.parse(lv.endDate);
          takenDays += getOverlappingDays(lvStart, lvEnd, activePeriod['start']!, activePeriod['end']!);
        } catch (_) {}
      }
    }

    int newDuration = 0;
    if (_selectedType == 'cuti' && _startDate != null && _endDate != null) {
      newDuration = _endDate!.difference(_startDate!).inDays + 1;
    }
    final totalInPeriod = takenDays + newDuration;
    final isLeaveLimitExceeded = _selectedType == 'cuti' && (newDuration > maxLeaveLimit || totalInPeriod > maxLeaveLimit);

    const Map<String, String> typeLabels = {
      'cuti': 'Libur Reguler',
      'sakit': 'Sakit',
      'izin': 'Izin',
      'setengah_hari': 'Masuk Setengah Hari',
      'kasbon': 'Kasbon',
    };

    return Scaffold(
      backgroundColor: darkBg,
      body: RefreshIndicator(
        onRefresh: () async {
          await auth.fetchLeaveHistory();
          await auth.fetchPolicies();
        },
        color: creamAccent,
        backgroundColor: cardBg,
        child: ListView(
          padding: const EdgeInsets.all(16.0),
          children: [
            // Security Header Banner
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withOpacity(0.12),
                border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.35)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                '🔒 Pusat Pengajuan Mandiri: Terhubung Dinamis ke Kebijakan Perusahaan SQLite & LocalStorage.',
                style: TextStyle(color: creamAccent, fontSize: 11, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
            ),

            // Main Submission Form
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
                    'Pusat Pengajuan Baru',
                    style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),

                  if (isLeaveLimitExceeded)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.12),
                        border: Border.all(color: Colors.red.withOpacity(0.35)),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '❌ Pengajuan Libur melebihi batas maksimal ($maxLeaveLimit hari) per periode cut-off!\n(Terpakai: $takenDays hari, Baru: $newDuration hari)',
                        style: const TextStyle(color: creamAccent, fontSize: 12, fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ),
                    ),

                  const Text('Jenis Pengajuan', style: TextStyle(color: textMuted, fontSize: 12)),
                  const SizedBox(height: 8),
                  
                  // Premium Styled Dropdown
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: darkBg,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedType,
                        dropdownColor: cardBg,
                        icon: const Icon(Icons.arrow_drop_down, color: creamAccent),
                        isExpanded: true,
                        style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 14),
                        onChanged: (String? newValue) {
                          if (newValue != null) {
                            setState(() {
                              _selectedType = newValue;
                              _startDate = null;
                              _endDate = null;
                              _halfDayClockOutTime = null;
                              _amountController.clear();
                            });
                          }
                        },
                        items: typeLabels.entries.map((entry) {
                          return DropdownMenuItem<String>(
                            value: entry.key,
                            child: Text(entry.value, style: const TextStyle(fontWeight: FontWeight.w500)),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // CONDITIONAL FORM FIELDS BASED ON TYPE
                  if (_selectedType == 'setengah_hari') ...[
                    // Date picker
                    const Text('Tanggal Masuk', style: TextStyle(color: textMuted, fontSize: 12)),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: () => _selectDate(context, true),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: darkBg, borderRadius: BorderRadius.circular(10)),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _startDate == null ? 'Pilih Tanggal' : DateFormat('yyyy-MM-dd').format(_startDate!),
                              style: TextStyle(color: _startDate == null ? Color(0x8DEEEEEE) : Color(0xFFEEEEEE)),
                            ),
                            const Icon(Icons.calendar_today, color: creamAccent, size: 18),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Time picker
                    const Text('Jam Pulang Aktual', style: TextStyle(color: textMuted, fontSize: 12)),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: () => _selectTime(context),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: darkBg, borderRadius: BorderRadius.circular(10)),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _halfDayClockOutTime == null
                                  ? 'Pilih Jam'
                                  : '${_halfDayClockOutTime!.hour.toString().padLeft(2, '0')}:${_halfDayClockOutTime!.minute.toString().padLeft(2, '0')} WIB',
                              style: TextStyle(color: _halfDayClockOutTime == null ? Color(0x8DEEEEEE) : Color(0xFFEEEEEE)),
                            ),
                            const Icon(Icons.access_time, color: creamAccent, size: 18),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: creamAccent.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        '💡 Ketentuan: Jam pulang setengah hari reguler diatur oleh kebijakan. Jika pulang < 18:00 WIB, dikenakan denda alpa parsial sebesar Gaji Pokok / 30.',
                        style: TextStyle(color: textMuted, fontSize: 11, height: 1.3),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ] else if (_selectedType == 'kasbon') ...[
                    // Date of Advance request
                    const Text('Tanggal Kebutuhan Kasbon', style: TextStyle(color: textMuted, fontSize: 12)),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: () => _selectDate(context, true),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: darkBg, borderRadius: BorderRadius.circular(10)),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _startDate == null ? 'Pilih Tanggal' : DateFormat('yyyy-MM-dd').format(_startDate!),
                              style: TextStyle(color: _startDate == null ? Color(0x8DEEEEEE) : Color(0xFFEEEEEE)),
                            ),
                            const Icon(Icons.calendar_today, color: creamAccent, size: 18),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Amount input field
                    const Text('Nominal Kasbon (Rp)', style: TextStyle(color: textMuted, fontSize: 12)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _amountController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: Color(0xFFEEEEEE)),
                      decoration: InputDecoration(
                        hintText: 'Maksimal Rp 500.000 & 50% Gaji Pokok',
                        hintStyle: const TextStyle(color: Color(0x62EEEEEE)),
                        filled: true,
                        fillColor: darkBg,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                        contentPadding: const EdgeInsets.all(14),
                        prefixIcon: const Icon(Icons.payments, color: creamAccent),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ] else ...[
                    // For Cuti, Sakit, Izin
                    const Text('Tanggal Mulai', style: TextStyle(color: textMuted, fontSize: 12)),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: () => _selectDate(context, true),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: darkBg, borderRadius: BorderRadius.circular(10)),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _startDate == null ? 'Pilih Tanggal' : DateFormat('yyyy-MM-dd').format(_startDate!),
                              style: TextStyle(color: _startDate == null ? Color(0x8DEEEEEE) : Color(0xFFEEEEEE)),
                            ),
                            const Icon(Icons.calendar_today, color: creamAccent, size: 18),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    const Text('Tanggal Akhir', style: TextStyle(color: textMuted, fontSize: 12)),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: () => _selectDate(context, false),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: darkBg, borderRadius: BorderRadius.circular(10)),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _endDate == null ? 'Pilih Tanggal' : DateFormat('yyyy-MM-dd').format(_endDate!),
                              style: TextStyle(color: _endDate == null ? Color(0x8DEEEEEE) : Color(0xFFEEEEEE)),
                            ),
                            const Icon(Icons.calendar_today, color: creamAccent, size: 18),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Common Reason input field
                  const Text('Alasan Pengajuan / Keterangan', style: TextStyle(color: textMuted, fontSize: 12)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _reasonController,
                    maxLines: 2,
                    style: const TextStyle(color: Color(0xFFEEEEEE)),
                    decoration: InputDecoration(
                      hintText: 'Tuliskan alasan pengajuan Anda secara lengkap...',
                      hintStyle: const TextStyle(color: Color(0x62EEEEEE)),
                      filled: true,
                      fillColor: darkBg,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.all(14),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // SUBMIT BUTTON
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton(
                      onPressed: (auth.isLoading || isLeaveLimitExceeded)
                          ? null
                          : () => _onSubmit(auth),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: creamAccent,
                        disabledBackgroundColor: creamAccent.withOpacity(0.35),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: auth.isLoading
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Color(0xFF00ADB5), strokeWidth: 2))
                          : const Text(
                              'Kirim Pengajuan Ke Admin',
                              style: TextStyle(color: Color(0xFF393E46), fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // RIWAYAT PENGAJUAN
            const Text(
              'Riwayat Pengajuan Mandiri',
              style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),

            if (auth.leaveHistory.isEmpty) ...[
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(32.0),
                  child: Text('Belum ada riwayat pengajuan.', style: TextStyle(color: textMuted, fontSize: 13)),
                ),
              )
            ] else ...[
              ...auth.leaveHistory.map((item) {
                final label = typeLabels[item.leaveType] ?? item.leaveType;
                
                String dateRangeStr;
                if (item.leaveType == 'setengah_hari' || item.leaveType == 'kasbon') {
                  dateRangeStr = item.startDate;
                } else {
                  dateRangeStr = '${item.startDate} s/d ${item.endDate}';
                }

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16.0),
                  decoration: BoxDecoration(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.03)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '$label ($dateRangeStr)',
                            style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: item.status == 'approved'
                                  ? success.withOpacity(0.12)
                                  : item.status == 'rejected'
                                      ? Colors.red.withOpacity(0.12)
                                      : warning.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              item.status == 'approved'
                                  ? 'Disetujui'
                                  : item.status == 'rejected'
                                      ? 'Ditolak'
                                      : 'Menunggu',
                              style: TextStyle(
                                color: item.status == 'approved'
                                    ? success
                                    : item.status == 'rejected'
                                        ? Colors.red
                                        : warning,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      if (item.leaveType == 'kasbon' && item.cashAdvanceAmount != null) ...[
                        Text(
                          'Nominal Kasbon: ${currencyFormatter.format(item.cashAdvanceAmount)}',
                          style: const TextStyle(color: creamAccent, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                      ],
                      if (item.leaveType == 'setengah_hari' && item.halfDayClockOut != null) ...[
                        Text(
                          'Jam Pulang Aktual: ${item.halfDayClockOut} WIB',
                          style: const TextStyle(color: creamAccent, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                      ],

                      Text(
                        'Alasan: ${item.reason}',
                        style: const TextStyle(color: textMuted, fontSize: 12),
                      ),
                      if (item.approvedByEmail != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Diproses oleh: ${item.approvedByEmail}',
                          style: const TextStyle(color: textMuted, fontSize: 10, fontStyle: FontStyle.italic),
                        ),
                      ]
                    ],
                  ),
                );
              }).toList()
            ]
          ],
        ),
      ),
    );
  }
}
