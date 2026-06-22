import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../models/models.dart';
import '../config/api_client.dart';

// Helper class untuk memicu pembukaan browser HP secara native via MethodChannel
class NativeBrowser {
  static const _channel = MethodChannel('com.example.hris_employee/open_browser');

  static Future<void> openUrl(String url) async {
    try {
      await _channel.invokeMethod('openUrl', {'url': url});
    } catch (e) {
      debugPrint("Gagal membuka browser native: $e");
    }
  }
}

class SopScreen extends StatefulWidget {
  const SopScreen({Key? key}) : super(key: key);

  @override
  State<SopScreen> createState() => _SopScreenState();
}

class _SopScreenState extends State<SopScreen> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _docSearchController = TextEditingController();
  String _searchQuery = '';
  String _docSearchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    _docSearchController.dispose();
    super.dispose();
  }

  void _showSopDetailsDialog(BuildContext context, SopRecord sop) {
    const darkBg = Color(0xFF222831); // Hitam Pekat
    const cardBg = Color(0xFF393E46); // Cokelat Tua
    const violet = Color(0xFFEEEEEE); // Krem (accent)
    const textMuted = Color(0x8DEEEEEE); // Krem muted
    const warning = Color(0xFFF59E0B);
    const success = Color(0xFF10B981);

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          backgroundColor: cardBg,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.75,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              sop.nomor ?? 'NO NOMOR',
                              style: const TextStyle(
                                color: violet,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              sop.judul,
                              style: const TextStyle(
                                color: Color(0xFFEEEEEE),
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Color(0xFFEEEEEE)),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(color: Color(0x1AEEEEEE)),
                  const SizedBox(height: 12),

                  // Scrollable Content
                  Expanded(
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Metadata: Jabatan Terkait
                          _buildMetaRow('Jabatan Terkait', sop.jabatanTerkait ?? 'Umum', context),
                          const SizedBox(height: 12),

                          // Metadata: Target Akses Peran
                          _buildMetaRow(
                            'Target Pengguna',
                            sop.sasaranRole.join(', '),
                            context,
                            badgeColor: warning.withOpacity(0.15),
                            textColor: warning,
                          ),
                          const SizedBox(height: 12),

                          // Metadata: Berlaku Di
                          _buildMetaRow(
                            'Berlaku Di Cabang',
                            sop.hanyaOutletTerpilih 
                                ? sop.berlakuDi.join(', ') 
                                : 'Semua Cabang (Global)',
                            context,
                            badgeColor: success.withOpacity(0.15),
                            textColor: success,
                          ),
                          const SizedBox(height: 20),

                          // Content
                          const Text(
                            'Isi Prosedur Operasional:',
                            style: TextStyle(
                              color: textMuted,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: darkBg.withOpacity(0.5),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.05)),
                            ),
                            child: Text(
                              sop.isi ?? 'Tidak ada detail isi.',
                              style: const TextStyle(
                                color: Color(0xFFEEEEEE),
                                fontSize: 13.5,
                                height: 1.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),
                  const Divider(color: Color(0x1AEEEEEE)),
                  const SizedBox(height: 12),

                  // Footer / Validation Label
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          '📢 ${sop.keteranganValidasi ?? "Diketahui oleh: General Manager"}',
                          style: const TextStyle(
                            color: textMuted,
                            fontSize: 11,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: violet,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text('TUTUP'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildMetaRow(String label, String value, BuildContext context, {Color? badgeColor, Color? textColor}) {
    const textMuted = Color(0x8DEEEEEE); // Krem muted
    const violet = Color(0xFFEEEEEE); // Krem (accent)

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: textMuted, fontSize: 11, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: badgeColor ?? violet.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            value,
            style: TextStyle(
              color: textColor ?? violet,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final sops = auth.sopList;
    final docs = auth.documentationList.where((d) => d.status == 'aktif').toList();

    const darkBg = Color(0xFF222831); // Hitam Pekat
    const cardBg = Color(0xFF393E46); // Cokelat Tua
    const violet = Color(0xFFEEEEEE); // Krem (accent)
    const textMuted = Color(0x8DEEEEEE); // Krem muted
    const success = Color(0xFF10B981);

    // Filter list SOP berdasarkan pencarian
    final filteredSops = sops.where((sop) {
      final query = _searchQuery.toLowerCase();
      return sop.judul.toLowerCase().contains(query) ||
             (sop.nomor ?? '').toLowerCase().contains(query) ||
             (sop.jabatanTerkait ?? '').toLowerCase().contains(query);
    }).toList();

    // Filter list Dokumentasi berdasarkan pencarian
    final filteredDocs = docs.where((doc) {
      final query = _docSearchQuery.toLowerCase();
      return doc.judul.toLowerCase().contains(query) ||
             doc.isi.toLowerCase().contains(query);
    }).toList();

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: darkBg,
        appBar: const PreferredSize(
          preferredSize: Size.fromHeight(48),
          child: TabBar(
            tabs: [
              Tab(text: 'SOP & PROSEDUR'),
              Tab(text: 'DOKUMENTASI'),
            ],
            labelColor: violet,
            unselectedLabelColor: textMuted,
            indicatorColor: violet,
            dividerColor: Colors.transparent,
            labelStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.5),
          ),
        ),
        body: TabBarView(
          children: [
            // --- TAB 1: SOP & PROSEDUR ---
            RefreshIndicator(
              onRefresh: () async {
                await auth.fetchInitialData();
              },
              child: Column(
                children: [

                  // Search Bar SOP
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                    child: Container(
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.05)),
                      ),
                      child: TextField(
                        controller: _searchController,
                        onChanged: (val) {
                          setState(() {
                            _searchQuery = val;
                          });
                        },
                        decoration: const InputDecoration(
                          hintText: 'Cari SOP ...',
                          hintStyle: TextStyle(color: textMuted, fontSize: 13),
                          prefixIcon: Icon(Icons.search, color: textMuted),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(vertical: 12),
                        ),
                        style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13),
                      ),
                    ),
                  ),

                  // Content (Spinner or List)
                  Expanded(
                    child: auth.isLoading
                        ? const Center(
                            child: CircularProgressIndicator(color: Color(0xFF00ADB5)),
                          )
                        : filteredSops.isEmpty
                            ? const Center(
                                child: Text(
                                  'Tidak ada berkas SOP tersedia.',
                                  style: TextStyle(color: textMuted, fontSize: 13),
                                ),
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
                                itemCount: filteredSops.length,
                                itemBuilder: (context, index) {
                                  final sop = filteredSops[index];
                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    decoration: BoxDecoration(
                                      color: cardBg,
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.04)),
                                    ),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(16),
                                      onTap: () => _showSopDetailsDialog(context, sop),
                                      child: Padding(
                                        padding: const EdgeInsets.all(16.0),
                                        child: Row(
                                          children: [
                                            Container(
                                              width: 44,
                                              height: 44,
                                              decoration: BoxDecoration(
                                                color: violet.withOpacity(0.1),
                                                borderRadius: BorderRadius.circular(10),
                                              ),
                                              child: const Icon(
                                                Icons.menu_book_outlined,
                                                color: violet,
                                                size: 22,
                                              ),
                                            ),
                                            const SizedBox(width: 16),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    sop.nomor ?? 'NO NOMOR',
                                                    style: const TextStyle(
                                                      color: violet,
                                                      fontSize: 11,
                                                      fontWeight: FontWeight.bold,
                                                    ),
                                                  ),
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    sop.judul,
                                                    style: const TextStyle(
                                                      color: Color(0xFFEEEEEE),
                                                      fontSize: 13.5,
                                                      fontWeight: FontWeight.bold,
                                                    ),
                                                    maxLines: 2,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                  const SizedBox(height: 4),
                                                  Text(
                                                    'Divisi: ${sop.jabatanTerkait ?? "Umum"}',
                                                    style: const TextStyle(
                                                      color: textMuted,
                                                      fontSize: 11.5,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            const Icon(
                                              Icons.chevron_right,
                                              color: textMuted,
                                              size: 20,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                  ),
                ],
              ),
            ),

            // --- TAB 2: ARSIP DOKUMENTASI (Tampilan Tabel Web-Based) ---
            RefreshIndicator(
              onRefresh: () async {
                await auth.fetchInitialData();
              },
              child: Column(
                children: [

                  // Search Bar Dokumentasi
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                    child: Container(
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.05)),
                      ),
                      child: TextField(
                        controller: _docSearchController,
                        onChanged: (val) {
                          setState(() {
                            _docSearchQuery = val;
                          });
                        },
                        decoration: const InputDecoration(
                          hintText: 'Cari Dokumentasi ...',
                          hintStyle: TextStyle(color: textMuted, fontSize: 13),
                          prefixIcon: Icon(Icons.search, color: textMuted),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(vertical: 12),
                        ),
                        style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 13),
                      ),
                    ),
                  ),

                  // Content: Spinner atau Tabel Data
                  Expanded(
                    child: auth.isLoading
                        ? const Center(
                            child: CircularProgressIndicator(color: Color(0xFF00ADB5)),
                          )
                        : filteredDocs.isEmpty
                            ? const Center(
                                child: Text(
                                  'Tidak ada berkas dokumentasi aktif.',
                                  style: TextStyle(color: textMuted, fontSize: 13),
                                ),
                              )
                            : SingleChildScrollView(
                                scrollDirection: Axis.vertical,
                                child: SingleChildScrollView(
                                  scrollDirection: Axis.horizontal,
                                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: cardBg,
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: Color(0xFFEEEEEE).withOpacity(0.05)),
                                    ),
                                    child: DataTable(
                                      headingRowColor: MaterialStateProperty.all(violet.withOpacity(0.1)),
                                      dataRowMaxHeight: 80,
                                      columns: const [
                                        DataColumn(label: Text('Tanggal', style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 11, fontWeight: FontWeight.bold))),
                                        DataColumn(label: Text('Judul Dokumentasi', style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 11, fontWeight: FontWeight.bold))),
                                        DataColumn(label: Text('Isi (Klik untuk Pratinjau)', style: TextStyle(color: Color(0xFFEEEEEE), fontSize: 11, fontWeight: FontWeight.bold))),
                                      ],
                                      rows: List<DataRow>.generate(filteredDocs.length, (index) {
                                        final doc = filteredDocs[index];
                                        return DataRow(
                                          cells: [
                                            DataCell(Text(doc.tanggalPublish, style: const TextStyle(color: textMuted, fontSize: 11))),
                                            DataCell(
                                              Container(
                                                constraints: const BoxConstraints(maxWidth: 150),
                                                child: Text(
                                                  toTitleCase(doc.judul),
                                                  style: const TextStyle(color: Color(0xFFEEEEEE), fontSize: 12, fontWeight: FontWeight.bold),
                                                  maxLines: 2,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                            ),
                                            DataCell(
                                              InkWell(
                                                onTap: () {
                                                  // Pemicu pembukaan browser HP untuk preview HTML ramah mobile
                                                  final url = '${ApiClient.baseUrl}/documentations/${doc.id}/preview';
                                                  NativeBrowser.openUrl(url);
                                                },
                                                child: Container(
                                                  padding: const EdgeInsets.symmetric(vertical: 8),
                                                  child: Text(
                                                    toTitleCase(doc.isi),
                                                    style: const TextStyle(
                                                      color: success,
                                                      fontSize: 12,
                                                      decoration: TextDecoration.underline,
                                                      fontWeight: FontWeight.w600,
                                                    ),
                                                    maxLines: 2,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ],
                                        );
                                      }),
                                    ),
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
}

String toTitleCase(String text) {
  if (text.isEmpty) return text;
  return text.split(' ').map((word) {
    if (word.isEmpty) return '';
    return word[0].toUpperCase() + word.substring(1).toLowerCase();
  }).join(' ');
}
