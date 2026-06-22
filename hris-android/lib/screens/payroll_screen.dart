import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/auth_provider.dart';
import '../models/models.dart';

const _kSlipKey = 'hris_payroll_mobile_slips';

const _bulan = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// ─── Warna Palet ─────────────────────────────────────────────────────────────
const _bgMain    = Color(0xFF222831);
const _bgSurface = Color(0xFF393E46);
const _accent    = Color(0xFF00ADB5);
const _cream     = Color(0xFFEEEEEE);
const _creamMuted = Color(0x8DEEEEEE);
const _success   = Color(0xFF2ECC71);
const _danger    = Color(0xFFE74C3C);
const _warning   = Color(0xFFF39C12);

class PayrollScreen extends StatefulWidget {
  const PayrollScreen({Key? key}) : super(key: key);

  @override
  State<PayrollScreen> createState() => _PayrollScreenState();
}

class _PayrollScreenState extends State<PayrollScreen> {
  List<LocalPayrollSlip> _slips = [];
  bool _loading = true;

  final _currencyFmt = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    _loadSlips();
  }

  Future<void> _loadSlips() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kSlipKey) ?? '[]';
      final List<dynamic> list = jsonDecode(raw);

      final auth = Provider.of<AuthProvider>(context, listen: false);
      final myName = auth.profile?.fullName?.toLowerCase() ?? '';
      final myId   = auth.profile?.id.toString() ?? '';
      final myEmpId = auth.profile?.employeeId?.toString() ?? '';

      bool changed = false;
      final List<dynamic> updatedList = list.map((item) {
        final Map<String, dynamic> slipMap = Map<String, dynamic>.from(item as Map);
        final slip = LocalPayrollSlip.fromJson(slipMap);
        if (slip.employeeId == myId ||
            slip.employeeId == myEmpId ||
            slip.namaKaryawan.toLowerCase().contains(myName)) {
          if (slipMap['is_read'] != true) {
            slipMap['is_read'] = true;
            changed = true;
          }
        }
        return slipMap;
      }).toList();

      if (changed) {
        await prefs.setString(_kSlipKey, jsonEncode(updatedList));
      }

      final filtered = updatedList.where((item) {
        final slip = LocalPayrollSlip.fromJson(item as Map<String, dynamic>);
        return slip.employeeId == myId ||
               slip.employeeId == myEmpId ||
               slip.namaKaryawan.toLowerCase().contains(myName);
      }).map((item) => LocalPayrollSlip.fromJson(item as Map<String, dynamic>)).toList();

      // Urutkan terbaru
      filtered.sort((a, b) {
        final ai = a.tahun * 12 + a.bulan;
        final bi = b.tahun * 12 + b.bulan;
        return bi.compareTo(ai);
      });

      setState(() {
        _slips = filtered;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bgMain,
      body: RefreshIndicator(
        color: _cream,
        backgroundColor: _bgSurface,
        onRefresh: _loadSlips,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Label Hak Akses ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: _accent.withOpacity(0.35),
                border: Border.all(color: _accent),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                '🔒 Slip gaji ini bersifat rahasia dan hanya bisa dilihat oleh karyawan yang bersangkutan.',
                style: TextStyle(color: _cream, fontSize: 11, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
            ),

            // ── Header ──
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Slip Gaji Saya',
                  style: TextStyle(color: _cream, fontSize: 20, fontWeight: FontWeight.w800),
                ),
                GestureDetector(
                  onTap: _loadSlips,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: _accent,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.refresh, color: _cream, size: 18),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            if (_loading) ...[
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: CircularProgressIndicator(color: Color(0xFF00ADB5)),
                ),
              )
            ] else if (_slips.isEmpty) ...[
              Container(
                margin: const EdgeInsets.only(top: 40),
                child: Column(
                  children: [
                    Icon(Icons.receipt_long_outlined, color: _accent, size: 60),
                    const SizedBox(height: 16),
                    const Text(
                      'Belum ada slip gaji tersedia.',
                      style: TextStyle(color: _creamMuted, fontSize: 15, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Slip gaji akan muncul setelah Admin\nmengirimkan data penggajian.',
                      style: TextStyle(color: _creamMuted, fontSize: 12),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              )
            ] else ...[
              ..._slips.map((slip) => _buildSlipCard(slip)).toList(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSlipCard(LocalPayrollSlip slip) {
    final bulanStr = slip.bulan > 0 && slip.bulan <= 12 ? _bulan[slip.bulan - 1] : '-';
    final periodeStr = '$bulanStr ${slip.tahun}';

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: _bgSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _accent),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.4), blurRadius: 16, offset: const Offset(0, 6)),
        ],
      ),
      child: Column(
        children: [
          // ── Card Header ──
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            decoration: BoxDecoration(
              color: _accent,
              borderRadius: const BorderRadius.only(topLeft: Radius.circular(17), topRight: Radius.circular(17)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      slip.namaKaryawan,
                      style: const TextStyle(color: _cream, fontSize: 14, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${slip.jabatan} • ${slip.outlet}',
                      style: TextStyle(color: _cream.withOpacity(0.7), fontSize: 11),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: _cream.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: _cream.withOpacity(0.3)),
                  ),
                  child: Text(
                    periodeStr,
                    style: const TextStyle(color: _cream, fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              children: [
                // ── Bagian Pendapatan ──
                _buildSectionTitle('📈 Komponen Pendapatan', _success),
                const SizedBox(height: 10),
                _buildIncomeRows(slip),

                const SizedBox(height: 4),
                _buildDivider(),
                _buildTotalRow('Total Pendapatan', slip.totalPendapatan, _success, bold: true),
                _buildDivider(),
                const SizedBox(height: 14),

                // ── Bagian Pengeluaran ──
                _buildSectionTitle('📉 Komponen Pengeluaran', _danger),
                const SizedBox(height: 10),
                _buildDeductionRows(slip),

                const SizedBox(height: 4),
                _buildDivider(),
                _buildTotalRow('Total Pengeluaran', slip.totalPengeluaran, _danger, prefix: '-', bold: true),
                _buildDivider(),
                const SizedBox(height: 16),

                // ── THP Box ──
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: slip.thp >= 0
                        ? _cream.withOpacity(0.08)
                        : _danger.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: slip.thp >= 0 ? _cream.withOpacity(0.4) : _danger,
                      width: 1.5,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '💸 Gaji Take Home Pay',
                            style: TextStyle(color: _cream, fontSize: 13, fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Pendapatan − Pengeluaran',
                            style: TextStyle(color: _creamMuted, fontSize: 10),
                          ),
                        ],
                      ),
                      Text(
                        _currencyFmt.format(slip.thp),
                        style: TextStyle(
                          color: slip.thp >= 0 ? _cream : _danger,
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),

                if (slip.sentAt != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    'Dikirim: ${slip.sentAt!.substring(0, 10)}',
                    style: const TextStyle(color: _creamMuted, fontSize: 10),
                  ),
                ],

                // ── Info Lama Bekerja ──
                if (slip.lamaBekerja.isNotEmpty && slip.lamaBekerja != '-') ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(Icons.work_history, color: _creamMuted, size: 13),
                      const SizedBox(width: 5),
                      Text(
                        'Masa Kerja: ${slip.lamaBekerja}',
                        style: const TextStyle(color: _creamMuted, fontSize: 11),
                      ),
                    ],
                  ),
                ]
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title, Color color) {
    return Row(
      children: [
        Container(width: 3, height: 14, color: color, margin: const EdgeInsets.only(right: 8)),
        Text(title, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w800)),
      ],
    );
  }

  Widget _buildDivider() => Divider(color: _accent.withOpacity(0.5), height: 1);

  Widget _buildRow(String label, double value, {Color? valueColor, String prefix = ''}) {
    if (value == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: _creamMuted, fontSize: 12)),
          Text(
            '$prefix${_currencyFmt.format(value)}',
            style: TextStyle(
              color: valueColor ?? _cream,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalRow(String label, double value, Color color, {String prefix = '', bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: _cream, fontSize: 13, fontWeight: bold ? FontWeight.w800 : FontWeight.w500)),
          Text(
            '$prefix${_currencyFmt.format(value)}',
            style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }

  Widget _buildIncomeRows(LocalPayrollSlip s) {
    return Column(children: [
      _buildRow('Gaji Pokok', s.gajiPokok),
      _buildRow('Uang Makan', s.uangMakan),
      _buildRow('Uang Lembur', s.uangLembur),
      _buildRow('Tunjangan Keluarga', s.tunjanganKeluarga),
      _buildRow('Tunjangan Jabatan', s.tunjanganJabatan),
      _buildRow('Tunjangan Posisi', s.tunjanganPosisi),
      _buildRow('Tunjangan Tidak Absen', s.tunjanganTidakAbsen),
      _buildRow('Tunjangan Lama Bekerja', s.tunjanganLamaBekerja),
      _buildRow('Tunjangan Lain-Lain', s.tunjanganLain),
      _buildRow('Adjust Gaji Sebelumnya', s.adjustGaji),
    ]);
  }

  Widget _buildDeductionRows(LocalPayrollSlip s) {
    return Column(children: [
      _buildRow('Kasbon', s.kasbon, valueColor: _danger, prefix: '-'),
      _buildRow('Libur Reguler', s.liburReguler, valueColor: _danger, prefix: '-'),
      _buildRow('Sakit Rawat Inap', s.sakitRawatInap, valueColor: _danger, prefix: '-'),
      _buildRow('Sakit (Surat Dokter)', s.sakitSuratDokter, valueColor: _danger, prefix: '-'),
      _buildRow('Masuk Kerja ½ Hari', s.masukSetengahHari, valueColor: _danger, prefix: '-'),
      _buildRow('Libur Tambahan', s.liburTambahan, valueColor: _danger, prefix: '-'),
      _buildRow('Potongan Kelebihan Libur (>2 Hari)', s.potonganKelebihanLibur, valueColor: _danger, prefix: '-'),
      _buildRow('Denda Weekend & Libur Nasional', s.dendaWeekendLiburNasional, valueColor: _danger, prefix: '-'),
      _buildRow('Denda Keterlambat Istirahat', s.dendaKeterlambatIstirahat, valueColor: _danger, prefix: '-'),
    ]);
  }
}
