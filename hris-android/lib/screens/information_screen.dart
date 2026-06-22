import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../models/models.dart';
import '../config/api_client.dart';

class InformationScreen extends StatefulWidget {
  const InformationScreen({super.key});

  @override
  State<InformationScreen> createState() => _InformationScreenState();
}

class _InformationScreenState extends State<InformationScreen> {
  @override
  void initState() {
    super.initState();
    // Refresh data on enter
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      auth.fetchInformations();
      auth.fetchSanctions();
      auth.fetchContracts();
    });
  }

  void _showDetailDialog(BuildContext context, InformationRecord info, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF393E46),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEEEEE).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      info.kategori.toUpperCase(),
                      style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    info.judul,
                    style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      info.isiInformasi,
                      style: const TextStyle(color: Color(0x8DEEEEEE), fontSize: 14, height: 1.6),
                    ),
                    const SizedBox(height: 20),
                    const Divider(color: Color(0x1AEEEEEE)),
                    const SizedBox(height: 10),
                    // Read status info
                    if (info.isRead) ...[
                      Row(
                        children: [
                          const Icon(Icons.check_circle_outline, color: Color(0xFF10B981), size: 16),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'Sudah dibaca (${info.response == 'siap' ? 'Siap' : 'Tanya Admin'})',
                              style: const TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                    ] else ...[
                      const Row(
                        children: [
                          Icon(Icons.remove_red_eye_outlined, color: Colors.grey, size: 16),
                          SizedBox(width: 6),
                          Text(
                            'Belum Dibaca',
                            style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Apakah kamu sudah membaca dan mengerti?',
                        style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFEEEEEE),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                              ),
                              onPressed: () async {
                                await auth.markInformationRead(info.id, 'siap');
                                if (context.mounted) {
                                  Navigator.pop(context);
                                }
                              },
                              child: const Text('Siap', style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 12, fontWeight: FontWeight.bold)),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: Color(0x1AEEEEEE)),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                              ),
                              onPressed: () async {
                                await auth.markInformationRead(info.id, 'tanya_admin');
                                if (context.mounted) {
                                  Navigator.pop(context);
                                }
                              },
                              child: const Text(
                                'Aku nanya ke admin deh',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 11, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Tutup', style: TextStyle(color: Colors.grey)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final list = auth.informations;

    const darkBg = Color(0xFF222831); // Hitam Pekat
    const cardBg = Color(0xFF393E46); // Cokelat Tua
    const violet = Color(0xFFEEEEEE); // Krem (accent)
    const textMuted = Color(0x8DEEEEEE); // Krem muted

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: darkBg,
        appBar: AppBar(
          backgroundColor: darkBg,
          elevation: 0,
          centerTitle: true,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Color(0xFFEEEEEE)),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text(
            'PUSAT INFORMASI',
            style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1),
          ),
          bottom: TabBar(
            indicatorColor: violet,
            labelColor: violet,
            unselectedLabelColor: textMuted,
            indicatorSize: TabBarIndicatorSize.tab,
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
            tabs: const [
              Tab(text: 'Pengumuman'),
              Tab(text: 'Cuti'),
              Tab(text: 'SP / Sanksi'),
              Tab(text: 'Kontrak Kerja'),
            ],
          ),
        ),
        body: Column(
          children: [

            Expanded(
              child: TabBarView(
                children: [
                  // TAB 1: PENGUMUMAN
                  _buildAnnouncementsTab(auth, list, textMuted, cardBg, violet),
                  // TAB 2: STATUS CUTI
                  _buildLeaveNotificationsTab(auth, textMuted, cardBg, violet),
                  // TAB 3: SURAT SANKSI
                  _buildSanctionsTab(auth, textMuted, cardBg, violet),
                  // TAB 4: KONTRAK KERJA DIGITAL
                  _buildContractsTab(auth, textMuted, cardBg, violet),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAnnouncementsTab(AuthProvider auth, List<InformationRecord> list, Color textMuted, Color cardBg, Color violet) {
    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.notifications_off_outlined, color: textMuted, size: 48),
              SizedBox(height: 16),
              Text(
                'Tidak ada informasi pengumuman saat ini.',
                textAlign: TextAlign.center,
                style: TextStyle(color: textMuted, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16.0),
      itemCount: list.length,
      itemBuilder: (context, index) {
        final info = list[index];
        return GestureDetector(
          onTap: () => _showDetailDialog(context, info, auth),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16.0),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: info.isRead
                    ? Color(0xFFEEEEEE).withOpacity(0.03)
                    : violet.withOpacity(0.3),
                width: info.isRead ? 1 : 1.5,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: violet.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        info.kategori.toUpperCase(),
                        style: TextStyle(color: violet, fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                    Text(
                      info.createdAt.split(' ')[0],
                      style: TextStyle(color: textMuted, fontSize: 11),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  info.judul,
                  style: TextStyle(
                    color: Color(0xFFEEEEEE),
                    fontSize: 14,
                    fontWeight: info.isRead ? FontWeight.w600 : FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  info.isiInformasi,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: textMuted, fontSize: 12, height: 1.4),
                ),
                const SizedBox(height: 12),
                const Divider(color: Color(0x1AEEEEEE), height: 1),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          info.isRead ? Icons.check_circle : Icons.radio_button_unchecked,
                          size: 13,
                          color: info.isRead ? const Color(0xFF10B981) : violet,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          info.isRead
                              ? 'Sudah Dibaca (${info.response == 'siap' ? 'Siap' : 'Tanya Admin'})'
                              : 'Belum Dibaca',
                          style: TextStyle(
                            color: info.isRead ? const Color(0xFF10B981) : violet,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      'Detail →',
                      style: TextStyle(color: violet, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildLeaveNotificationsTab(AuthProvider auth, Color textMuted, Color cardBg, Color violet) {
    final logs = auth.leaveNotificationsLog.reversed.toList(); // Show latest first

    if (logs.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.assignment_turned_in_outlined, color: textMuted, size: 48),
              const SizedBox(height: 16),
              Text(
                'Belum ada pemberitahuan status cuti/izin.',
                textAlign: TextAlign.center,
                style: TextStyle(color: textMuted, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16.0),
      itemCount: logs.length,
      itemBuilder: (context, index) {
        final message = logs[index];
        final isApproved = message.contains('🟢') || message.toLowerCase().contains('setujui');
        final glowColor = isApproved ? const Color(0xFF2ECC71) : const Color(0xFFE74C3C);

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16.0),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: glowColor.withOpacity(0.35),
              width: 1.5,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: glowColor.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      isApproved ? 'DISETUJUI' : 'DITOLAK',
                      style: TextStyle(color: glowColor, fontSize: 9, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const Text(
                    'Kebijakan Cuti',
                    style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 11),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                message,
                style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, height: 1.4),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSanctionsTab(AuthProvider auth, Color textMuted, Color cardBg, Color violet) {
    final list = auth.sanctions;

    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.gavel_outlined, color: textMuted, size: 48),
              const SizedBox(height: 16),
              Text(
                'Mulus: Anda bersih dari catatan pelanggaran sanksi disiplin.',
                textAlign: TextAlign.center,
                style: TextStyle(color: textMuted, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16.0),
      itemCount: list.length,
      itemBuilder: (context, index) {
        final s = list[index];
        final isSp = s.tipeSanksi.startsWith('Surat Peringatan') || s.tipeSanksi == 'PHK';
        final glowColor = isSp ? const Color(0xFFEF4444) : const Color(0xFFF59E0B);

        return GestureDetector(
          onTap: () => _showSanctionDetailDialog(context, s, auth),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16.0),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: glowColor.withOpacity(0.35),
                width: 1.5,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: glowColor.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        s.tipeSanksi,
                        style: TextStyle(color: glowColor, fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                    Text(
                      s.status == 'aktif' ? '🔴 MASIH AKTIF' : '🟢 NON-AKTIF / SELESAI',
                      style: TextStyle(
                        color: s.status == 'aktif' ? const Color(0xFFEF4444) : const Color(0xFF2ECC71),
                        fontSize: 11,
                        fontWeight: FontWeight.bold
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Bentuk Kesalahan: ${s.bentukKesalahan}',
                  style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  'Kronologi: ${s.alasan}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: textMuted, fontSize: 12, height: 1.4),
                ),
                const SizedBox(height: 12),
                const Divider(color: Color(0x1AEEEEEE), height: 1),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Berlaku s/d: ${s.tanggalBerakhir}',
                      style: TextStyle(color: textMuted, fontSize: 11),
                    ),
                    Text(
                      'Detail Surat →',
                      style: TextStyle(color: violet, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showSanctionDetailDialog(BuildContext context, SanctionRecord s, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF393E46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          contentPadding: const EdgeInsets.all(24.0),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header Instansi
                Container(
                  padding: const EdgeInsets.only(bottom: 12),
                  decoration: const BoxDecoration(
                    border: Border(bottom: BorderSide(color: Colors.black, width: 2)),
                  ),
                  child: const Center(
                    child: Column(
                      children: [
                        Text(
                          'BAROKAH GRUP',
                          style: TextStyle(color: Colors.black, fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'Georgia'),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Sistem Penegakan Disiplin & Hukum Internal Perusahaan',
                          style: TextStyle(color: Colors.black54, fontSize: 9, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                
                // Jenis SP / Sanksi
                Center(
                  child: Text(
                    s.tipeSanksi.toUpperCase(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.black, fontSize: 14, fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                  ),
                ),
                const SizedBox(height: 16),
                
                const Text(
                  'Dengan evaluasi internal manajemen atas pelaporan dari lapangan dan terbukti valid, maka kami memberikan informasi:',
                  style: TextStyle(color: Colors.black87, fontSize: 11, fontStyle: FontStyle.italic),
                ),
                const SizedBox(height: 12),
                
                // Data Karyawan
                Table(
                  columnWidths: const {
                    0: FlexColumnWidth(1.2),
                    1: FlexColumnWidth(0.2),
                    2: FlexColumnWidth(2.6),
                  },
                  children: [
                    TableRow(children: [
                      const Padding(padding: EdgeInsets.symmetric(vertical: 2), child: Text('Nama Lengkap', style: TextStyle(color: Colors.black87, fontSize: 11, fontWeight: FontWeight.bold))),
                      const Padding(padding: EdgeInsets.symmetric(vertical: 2), child: Text(':', style: TextStyle(color: Colors.black87, fontSize: 11))),
                      Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Text(auth.profile?.fullName ?? '', style: const TextStyle(color: Colors.black, fontSize: 11))),
                    ]),
                    TableRow(children: [
                      const Padding(padding: EdgeInsets.symmetric(vertical: 2), child: Text('ID Karyawan', style: TextStyle(color: Colors.black87, fontSize: 11, fontWeight: FontWeight.bold))),
                      const Padding(padding: EdgeInsets.symmetric(vertical: 2), child: Text(':', style: TextStyle(color: Colors.black87, fontSize: 11))),
                      Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Text(auth.profile?.nik ?? '', style: const TextStyle(color: Colors.black, fontSize: 11))),
                    ]),
                    TableRow(children: [
                      const Padding(padding: EdgeInsets.symmetric(vertical: 2), child: Text('Jabatan / Outlet', style: TextStyle(color: Colors.black87, fontSize: 11, fontWeight: FontWeight.bold))),
                      const Padding(padding: EdgeInsets.symmetric(vertical: 2), child: Text(':', style: TextStyle(color: Colors.black87, fontSize: 11))),
                      Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Text('${s.position ?? auth.profile?.position ?? ''} / ${s.outlet ?? auth.profile?.outlet ?? ''}', style: const TextStyle(color: Colors.black, fontSize: 11))),
                    ]),
                    TableRow(children: [
                      const Padding(padding: EdgeInsets.symmetric(vertical: 2), child: Text('Bentuk Kesalahan', style: TextStyle(color: Colors.black87, fontSize: 11, fontWeight: FontWeight.bold))),
                      const Padding(padding: EdgeInsets.symmetric(vertical: 2), child: Text(':', style: TextStyle(color: Colors.black87, fontSize: 11))),
                      Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Text(s.bentukKesalahan, style: const TextStyle(color: Colors.black, fontSize: 11))),
                    ]),
                    TableRow(children: [
                      const Padding(padding: EdgeInsets.symmetric(vertical: 2), child: Text('Masa Berlaku', style: TextStyle(color: Colors.black87, fontSize: 11, fontWeight: FontWeight.bold))),
                      const Padding(padding: EdgeInsets.symmetric(vertical: 2), child: Text(':', style: TextStyle(color: Colors.black87, fontSize: 11))),
                      Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Text('${s.tanggalBerlaku} s/d ${s.tanggalBerakhir}', style: const TextStyle(color: Colors.black, fontSize: 11))),
                    ]),
                  ],
                ),
                const SizedBox(height: 16),
                
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: Colors.amber.shade200),
                  ),
                  child: Center(
                    child: Text(
                      'Surat ini diterbitkan pada tanggal ${s.tanggalTerbit ?? s.tanggalBerlaku} dan berlaku sampai dengan ${s.tanggalBerakhir} tanpa kesalahan',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                
                const Text(
                  'KETERANGAN PERKARA / KRONOLOGI:',
                  style: TextStyle(color: Colors.black, fontSize: 11, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  s.alasan,
                  textAlign: TextAlign.justify,
                  style: const TextStyle(color: Colors.black87, fontSize: 11, height: 1.5),
                ),
                const SizedBox(height: 16),
                
                const Center(
                  child: Text(
                    '"Semoga bisa ditindaklanjuti ke arah yang lebih baik."',
                    style: TextStyle(color: Colors.black54, fontSize: 11, fontStyle: FontStyle.italic),
                  ),
                ),
                const SizedBox(height: 24),
                
                // Signature Block
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      children: [
                        const Text('Dibuat Oleh,', style: TextStyle(color: Colors.black87, fontSize: 10)),
                        const SizedBox(height: 40),
                        const Text('HR Admin', style: TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold, decoration: TextDecoration.underline)),
                        const Text('Manajemen Barokah', style: TextStyle(color: Colors.black54, fontSize: 8)),
                      ],
                    ),
                    Column(
                      children: [
                        const Text('Diketahui Oleh,', style: TextStyle(color: Colors.black87, fontSize: 10)),
                        const SizedBox(height: 40),
                        Text(s.diketahuiOleh, style: const TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold, decoration: TextDecoration.underline)),
                        const Text('Petinggi Berwenang', style: TextStyle(color: Colors.black54, fontSize: 8)),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Tutup', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  Widget _buildContractsTab(AuthProvider auth, Color textMuted, Color cardBg, Color violet) {
    final list = auth.contracts;
    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.description_outlined, color: textMuted, size: 48),
              const SizedBox(height: 16),
              Text(
                'Tidak ada kontrak kerja digital aktif saat ini.',
                textAlign: TextAlign.center,
                style: TextStyle(color: textMuted, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16.0),
      itemCount: list.length,
      itemBuilder: (context, index) {
        final c = list[index];
        final isSigned = c.statusPersetujuan == 'KONTRAK DITANDATANGANI';
        return GestureDetector(
          onTap: () => _showContractDetailDialog(context, c, auth),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16.0),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: isSigned
                    ? const Color(0xFF2ECC71).withOpacity(0.3)
                    : const Color(0xFFF39C12).withOpacity(0.3),
                width: 1.5,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: violet.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        c.jenisKontrak,
                        style: TextStyle(color: violet, fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                    Text(
                      c.tanggalPembuatan,
                      style: TextStyle(color: textMuted, fontSize: 11),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  c.nomorSurat,
                  style: const TextStyle(
                    color: Color(0xFFEEEEEE),
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Masa Berlaku: ${c.tanggalPembuatan} s/d ${c.tanggalSelesai}',
                  style: TextStyle(color: textMuted, fontSize: 12),
                ),
                const SizedBox(height: 12),
                const Divider(color: Color(0x1AEEEEEE), height: 1),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          isSigned ? Icons.check_circle : Icons.warning_amber_rounded,
                          size: 13,
                          color: isSigned ? const Color(0xFF2ECC71) : const Color(0xFFF39C12),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          isSigned ? 'Kontrak Ditandatangani' : 'Menunggu Tanda Tangan',
                          style: TextStyle(
                            color: isSigned ? const Color(0xFF2ECC71) : const Color(0xFFF39C12),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      'Tinjau Kontrak →',
                      style: TextStyle(color: violet, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showContractDetailDialog(BuildContext context, ContractRecord c, AuthProvider auth) {
    final formatCurrency = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final isSigned = c.statusPersetujuan == 'KONTRAK DITANDATANGANI';
            return AlertDialog(
              backgroundColor: const Color(0xFF150C05),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFF00ADB5))),
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    c.jenisKontrak.toUpperCase(),
                    style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    c.nomorSurat,
                    style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.black26,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFF00ADB5)),
                        ),
                        child: Text(
                          'PERJANJIAN KERJA WAKTU TERTENTU (PKWT)\n'
                          'BAROKAH GRUP EKOSISTEM - ${c.outlet ?? auth.profile?.outlet ?? ''}\n'
                          'Nomor Surat: ${c.nomorSurat}\n\n'
                          'Yang bertanda tangan di bawah ini:\n'
                          '1. Nama: Harry Setiawan\n'
                          '   Jabatan: General Manager\n'
                          '   Alamat: Jl. Ahmad Yani Tebing Tinggi, Sumatera Utara\n'
                          'Dalam hal ini bertindak untuk Pemilik dan atas nama ${c.outlet ?? auth.profile?.outlet ?? ''} yang selanjutnya disebut sebagai PIHAK PERTAMA.\n\n'
                          '2. Nama Karyawan: ${c.namaKaryawan ?? auth.profile?.fullName ?? ''}\n'
                          '   No KTP / NIK: ${c.nikKaryawan ?? auth.profile?.nik ?? ''}\n'
                          '   Tempat & Tgl Lahir: ${c.address != null ? c.address!.split(',')[0] + ', 15 Juli 1997' : 'Tebing Tinggi, 15 Juli 1997'}\n'
                          '   Status Karyawan: Karyawan Kontrak\n'
                          'Dalam hal ini bertindak untuk dan atas nama pribadi, yang untuk selanjutnya disebut sebagai PIHAK KEDUA.\n\n'
                          'Pada hari ini, tanggal ${c.tanggalPembuatan}, Kedua belah pihak secara sadar mengadakan perjanjian kontrak kerja waktu tertentu (PKWT), dengan isi ketentuan pasal sebagai berikut:\n\n'
                          'Pasal 1: Ketentuan Umum\n'
                          '1. Dengan ditandatanganinya perjanjian ini, maka Pihak Kedua telah mengetahui, memahami, dan patuh terhadap seluruh peraturan perusahaan serta peraturan-peraturan lain yang diterbitkan oleh Pihak Pertama.\n'
                          '2. Perjanjian ini dibuat demi kepentingan bersama dalam memenuhi hak dan kewajiban Pihak Pertama sebagai pemberi kerja serta memenuhi hak dan kewajiban Pihak Kedua sebagai karyawan.\n\n'
                          'Pasal 2: Penunjukan Sebagai Karyawan\n'
                          '1. Pihak Pertama memberikan tanggung jawab penuh kepada Pihak Kedua dengan status sebagai Karyawan.\n'
                          '2. Pihak Kedua menerima mandat kerja tersebut dengan lokasi penempatan penugasan aktif di: ${c.outlet ?? auth.profile?.outlet ?? ''}.\n'
                          '3. Ikatan pekerjaan sebagaimana yang disebutkan pada pasal ini berlaku aktif terhitung sejak tanggal ${c.tanggalPembuatan} hingga tanggal berakhir pada ${c.tanggalSelesai}.\n\n'
                          'Pasal 3: Hak dan Kewajiban Pihak Pertama\n'
                          '1. Hak Pihak Pertama adalah memastikan Pihak Kedua menjalankan seluruh peraturan operasional perusahaan setelah menandatangani kontrak Perjanjian Kerja Waktu Tertentu ini.\n'
                          '2. Pihak Pertama berkewajiban melakukan pembayaran upah upah jasa kepada Pihak Kedua berupa gaji pokok dan tunjangan-tunjangan sesuai kesepakatan.\n\n'
                          'Pasal 4: Komponen Finansial & Hak Pihak Kedua\n'
                          'Pihak Kedua berhak menerima upah jasa bulanan dengan rincian data sebagai berikut:\n'
                          '- Gaji Pokok: ${formatCurrency.format(c.gajiPokok)}\n'
                          '- Uang Makan: ${formatCurrency.format(c.uangMakan)} per hari masuk kerja\n'
                          '- Uang Lembur: ${formatCurrency.format(c.uangLembur)} per hari lembur\n'
                          '- Tunjangan Lama Bekerja: ${formatCurrency.format(c.tunjanganLamaBekerja)}\n'
                          '- Tunjangan Keluarga: ${formatCurrency.format(c.tunjanganKeluarga)}\n\n'
                          'Pasal 5: Kerahasiaan Data & Resep Perusahaan\n'
                          'Pihak Kedua berkomitmen menjaga kerahasiaan resep kuliner, takaran bumbu, rahasia dagang, serta dokumen rahasia operasional Barokah Grup. Kebocoran informasi ini akan dikenakan sanksi pemutusan hubungan kerja langsung serta tuntutan ganti rugi perdata senilai Rp 25.000.000,- (Dua Puluh Lima Juta Rupiah).\n\n'
                          'Pasal 6: Pemutusan & Sanksi Pinalti\n'
                          'Apabila Pihak Kedua mengajukan pengunduran diri sepihak sebelum masa kontrak 1 (satu) tahun selesai tanpa persetujuan tertulis Pihak Pertama, atau melanggar kesepakatan dinas pelatihan kerja 3 (tiga) tahun berturut-turut, maka Pihak Kedua wajib mengganti rugi pinalti tunai sebesar Rp 25.000.000,- (Dua Puluh Lima Juta Rupiah) kepada Pihak Pertama.',
                          style: const TextStyle(color: Color(0x8DEEEEEE), fontSize: 11, height: 1.5),
                        ),
                      ),
                      const SizedBox(height: 16),
                      
                      // Sign / Download Panel
                      if (isSigned) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF2ECC71).withOpacity(0.12),
                            border: Border.all(color: const Color(0xFF2ECC71).withOpacity(0.35)),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.lock_outline, color: Color(0xFF2ECC71), size: 16),
                              SizedBox(width: 8),
                              Text(
                                '🔒 KONTRAK DITANDATANGANI DIGITAL',
                                style: TextStyle(color: Color(0xFF2ECC71), fontSize: 11, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFEEEEEE),
                              foregroundColor: Colors.black,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            icon: const Icon(Icons.download, size: 16),
                            label: const Text('📄 Download PDF', style: TextStyle(fontWeight: FontWeight.bold)),
                            onPressed: () {
                              final pdfUrl = '${ApiClient.baseUrl}/contracts/${c.id}/pdf';
                              Clipboard.setData(ClipboardData(text: pdfUrl));
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Link download PDF disalin ke clipboard! Silakan buka di browser handphone Anda.'),
                                  backgroundColor: Color(0xFF10B981),
                                ),
                              );
                            },
                          ),
                        ),
                      ] else ...[
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFEEEEEE),
                              foregroundColor: Colors.black,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            onPressed: () {
                              showDialog(
                                context: context,
                                builder: (context) {
                                  return AlertDialog(
                                    backgroundColor: const Color(0xFF393E46),
                                    title: const Text('Konfirmasi Kontrak Digital', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold)),
                                    content: const Text(
                                      'Baca sampai akhir, jika kamu menekan tombol OK, maka kamu otomatis menyetujui isi kontrak, jika tidak, maka kontrak dibatalkan.',
                                      style: TextStyle(color: Color(0x8DEEEEEE)),
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(context),
                                        child: const Text('CANCEL', style: TextStyle(color: Colors.grey)),
                                      ),
                                      TextButton(
                                        onPressed: () async {
                                          Navigator.pop(context); // Close confirm
                                          
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

                                          final success = await auth.signContract(c.id);

                                          if (context.mounted) {
                                            Navigator.pop(context); // Tutup fullscreen loading spinner
                                          }

                                          if (success) {
                                            if (context.mounted) {
                                              Navigator.pop(context); // Close detail dialog
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                const SnackBar(
                                                  content: Text('Kontrak Kerja berhasil ditandatangani digital!'),
                                                  backgroundColor: Color(0xFF2ECC71),
                                                ),
                                              );
                                            }
                                          } else {
                                            if (context.mounted) {
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                const SnackBar(
                                                  content: Text('Gagal menandatangani kontrak. Hubungi HRD.'),
                                                  backgroundColor: Color(0xFFEF4444),
                                                ),
                                              );
                                            }
                                          }
                                        },
                                        child: const Text('OK', style: TextStyle(color: Color(0xFFEEEEEE), fontWeight: FontWeight.bold)),
                                      ),
                                    ],
                                  );
                                },
                              );
                            },
                            child: const Text('SETUJUI KONTRAK DIGITAL', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Tutup', style: TextStyle(color: Colors.grey)),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
