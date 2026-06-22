import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({Key? key}) : super(key: key);

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  String _leaveType = 'cuti';
  final _startController = TextEditingController();
  final _endController = TextEditingController();
  final _reasonController = TextEditingController();

  @override
  void dispose() {
    _startController.dispose();
    _endController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  void _showConfirmDialog(String title, String message, VoidCallback onConfirm) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            title,
            style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
          ),
          content: Text(
            message,
            style: const TextStyle(color: Color(0x8DEEEEEE), fontSize: 14),
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
                        onConfirm();
                      },
                      child: const Text('YA', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold)),
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

  bool _checkHasWeekendOrPeakDay(String startStr, String endStr, List<dynamic> peakDays) {
    try {
      final start = DateTime.parse(startStr.trim());
      final end = DateTime.parse(endStr.trim());
      
      for (int i = 0; i <= end.difference(start).inDays; i++) {
        final date = start.add(Duration(days: i));
        
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
      print('Error parsing date range in _checkHasWeekendOrPeakDay: $e');
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final list = auth.leaveHistory;

    const darkBg = Color(0xFF222831); // Hitam Pekat
    const cardBg = Color(0xFF393E46); // Cokelat Tua
    const violet = Color(0xFFEEEEEE); // Krem (accent)
    const textMuted = Color(0x8DEEEEEE); // Krem muted
    const success = Color(0xFF10B981);
    const warning = Color(0xFFF59E0B);

    return Scaffold(
      backgroundColor: darkBg,
      body: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [

          // Submit Form
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
                  'Form Pengajuan Cuti / Izin',
                  style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                
                if (auth.successMessage != null) ...[
                  Text(
                    auth.successMessage!,
                    style: const TextStyle(color: success, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                ],

                const Text('Tipe Izin', style: TextStyle(color: textMuted, fontSize: 12)),
                const SizedBox(height: 8),
                Row(
                  children: ['cuti', 'izin', 'sakit'].map((type) {
                    final selected = _leaveType == type;
                    return Expanded(
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        height: 36,
                        child: ElevatedButton(
                          onPressed: () {
                            setState(() {
                              _leaveType = type;
                            });
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: selected ? violet : darkBg,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            padding: EdgeInsets.zero,
                          ),
                          child: Text(
                            type.toUpperCase(),
                            style: TextStyle(
                              color: selected ? Color(0xFFEEEEEE) : textMuted,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),

                TextField(
                  controller: _startController,
                  style: const TextStyle(color: Color(0xFFEEEEEE)),
                  decoration: InputDecoration(
                    labelText: 'Tanggal Mulai (YYYY-MM-DD)',
                    labelStyle: const TextStyle(color: textMuted),
                    filled: true,
                    fillColor: darkBg,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.all(14),
                  ),
                ),
                const SizedBox(height: 12),

                TextField(
                  controller: _endController,
                  style: const TextStyle(color: Color(0xFFEEEEEE)),
                  decoration: InputDecoration(
                    labelText: 'Tanggal Akhir (YYYY-MM-DD)',
                    labelStyle: const TextStyle(color: textMuted),
                    filled: true,
                    fillColor: darkBg,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.all(14),
                  ),
                ),
                const SizedBox(height: 12),

                TextField(
                  controller: _reasonController,
                  maxLines: 2,
                  style: const TextStyle(color: Color(0xFFEEEEEE)),
                  decoration: InputDecoration(
                    labelText: 'Alasan Pengajuan',
                    labelStyle: const TextStyle(color: textMuted),
                    filled: true,
                    fillColor: darkBg,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.all(14),
                  ),
                ),
                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton(
                    onPressed: auth.isLoading
                        ? null
                        : () {
                            if (_startController.text.isNotEmpty &&
                                _endController.text.isNotEmpty &&
                                _reasonController.text.isNotEmpty) {
                              final hasWeekendOrPeak = _checkHasWeekendOrPeakDay(
                                _startController.text,
                                _endController.text,
                                auth.peakDays,
                              );
                              
                              void proceedWithConfirmation() {
                                _showConfirmDialog(
                                  'Konfirmasi Pengajuan',
                                  'Apakah data pengajuan cuti/izin Anda sudah benar?',
                                  () {
                                    auth.submitFormPengajuan(
                                      _leaveType,
                                      _startController.text,
                                      _endController.text,
                                      _reasonController.text,
                                    );
                                    _startController.clear();
                                    _endController.clear();
                                    _reasonController.clear();
                                  },
                                );
                              }

                              if (hasWeekendOrPeak) {
                                _showConsequenceDialog(proceedWithConfirmation);
                              } else {
                                proceedWithConfirmation();
                              }
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: violet,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: auth.isLoading
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Color(0xFF00ADB5), strokeWidth: 2))
                        : const Text('Kirim Pengajuan', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          const Text(
            'Riwayat Pengajuan Cuti & Izin',
            style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),

          if (list.isEmpty) ...[
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24.0),
                child: Text('Belum ada riwayat pengajuan cuti.', style: TextStyle(color: textMuted, fontSize: 13)),
              ),
            )
          ] else ...[
            ...list.map((item) {
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
                          '${item.leaveType.toUpperCase()} (${item.startDate} s/d ${item.endDate})',
                          style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                        Text(
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
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Alasan: ${item.reason}',
                      style: const TextStyle(color: textMuted, fontSize: 12),
                    ),
                    if (item.approvedByEmail != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Diproses oleh: ${item.approvedByEmail}',
                        style: const TextStyle(color: textMuted, fontSize: 10),
                      ),
                    ]
                  ],
                ),
              );
            }).toList()
          ]
        ],
      ),
    );
  }
}
