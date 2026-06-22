import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../config/api_client.dart';
import 'sop_screen.dart'; // Import to use NativeBrowser

class TrainingScreen extends StatefulWidget {
  const TrainingScreen({Key? key}) : super(key: key);

  @override
  State<TrainingScreen> createState() => _TrainingScreenState();
}

class _TrainingScreenState extends State<TrainingScreen> {
  List<dynamic> _materials = [];
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchMaterials();
  }

  Future<void> _fetchMaterials() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      
      // Try hitting custom sync server first if configured, else query backend
      String endpoint = 'training-media';
      final res = await ApiClient.get(endpoint, token: auth.token);
      final data = jsonDecode(res.body);

      if (res.statusCode == 200) {
        setState(() {
          _materials = data['materials'] ?? data['data'] ?? [];
        });
      } else {
        _errorMessage = data['message'] ?? 'Gagal memuat materi training.';
      }
    } catch (e) {
      _errorMessage = 'Koneksi ke server terganggu.';
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  String? _getYouTubeId(String? url) {
    if (url == null) return null;
    final regExp = RegExp(
        r'^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*');
    final match = regExp.firstMatch(url);
    if (match != null && match.groupCount >= 2) {
      final id = match.group(2);
      if (id != null && id.length == 11) return id;
    }
    return null;
  }

  Widget _buildMaterialCard(dynamic item) {
    const cardBg = Color(0xFF393E46);
    const textMain = Color(0xFFEEEEEE);
    const textMuted = Color(0x8DEEEEEE);

    final title = toTitleCase(item['title'] ?? 'Materi Tanpa Judul');
    final desc = toTitleCase(item['desc'] ?? '');
    final type = item['file_type'] ?? 'pdf';
    final linkUrl = item['link_url'] ?? '';
    final fileData = item['file_data'] ?? '';

    // Determine colors/icons based on type
    Color typeColor = const Color(0xFF00ADB5);
    IconData typeIcon = Icons.file_present_outlined;
    Widget? mediaThumbnail;

    if (type == 'pdf') {
      typeColor = const Color(0xFFE05C5C);
      typeIcon = Icons.picture_as_pdf_outlined;
    } else if (type == 'image') {
      typeColor = const Color(0xFFF5A623);
      typeIcon = Icons.image_outlined;
      if (fileData.isNotEmpty) {
        mediaThumbnail = Image.memory(
          base64Decode(fileData.split(',').last),
          fit: BoxFit.cover,
          width: double.infinity,
          height: 120,
          errorBuilder: (context, error, stackTrace) => const SizedBox(),
        );
      }
    } else if (type == 'video') {
      typeColor = const Color(0xFFA78BFA);
      typeIcon = Icons.play_circle_outline;
      final ytId = _getYouTubeId(linkUrl);
      if (ytId != null) {
        mediaThumbnail = Stack(
          alignment: Alignment.center,
          children: [
            Image.network(
              'https://img.youtube.com/vi/$ytId/0.jpg',
              fit: BoxFit.cover,
              width: double.infinity,
              height: 120,
              errorBuilder: (context, error, stackTrace) => const SizedBox(),
            ),
            Container(
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.4),
                shape: BoxShape.circle,
              ),
              padding: const EdgeInsets.all(8),
              child: const Icon(Icons.play_arrow, color: Colors.white, size: 28),
            ),
          ],
        );
      }
    } else if (type == 'instagram') {
      typeColor = const Color(0xFFE1306C);
      typeIcon = Icons.camera_alt_outlined;
    } else if (type == 'tiktok') {
      typeColor = const Color(0xFF00ADB5);
      typeIcon = Icons.music_note_outlined;
    } else if (type == 'sosmed') {
      typeColor = const Color(0xFF4ECDC4);
      typeIcon = Icons.link;
    }

    return Card(
      color: cardBg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: typeColor.withOpacity(0.2), width: 1.5),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          if (linkUrl.isNotEmpty) {
            NativeBrowser.openUrl(linkUrl);
          } else if (fileData.isNotEmpty) {
            // If it's a data URL, we can open it natively
            NativeBrowser.openUrl(fileData);
          }
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with type label
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Row(
                children: [
                  Icon(typeIcon, color: typeColor, size: 20),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: typeColor.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      type.toUpperCase(),
                      style: TextStyle(color: typeColor, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
            
            // Media preview if available, else show styled branding card
            if (mediaThumbnail != null)
              mediaThumbnail
            else
              Container(
                height: 80,
                width: double.infinity,
                color: typeColor.withOpacity(0.04),
                child: Center(
                  child: Icon(typeIcon, color: typeColor.withOpacity(0.3), size: 40),
                ),
              ),

            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: textMain,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (desc.isNotEmpty)
                    Text(
                      desc,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: textMuted,
                        fontSize: 11,
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

  @override
  Widget build(BuildContext context) {
    const darkBg = Color(0xFF222831);
    const textMain = Color(0xFFEEEEEE);

    return Scaffold(
      backgroundColor: darkBg,
      appBar: AppBar(
        backgroundColor: darkBg,
        elevation: 0,
        title: const Text(
          'MATERI & MODUL TRAINING',
          style: TextStyle(color: textMain, fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1),
        ),
        centerTitle: true,
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
                        Text(_errorMessage!, style: const TextStyle(color: textMain, fontSize: 14), textAlign: TextAlign.center),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF393E46)),
                          onPressed: _fetchMaterials,
                          child: const Text('Muat Ulang', style: TextStyle(color: textMain)),
                        )
                      ],
                    ),
                  ),
                )
              : _materials.isEmpty
                  ? const Center(
                      child: Text(
                        'Belum ada materi pelatihan yang tersedia.',
                        style: TextStyle(color: Color(0x8DEEEEEE), fontSize: 13),
                      ),
                    )
                  : RefreshIndicator(
                      color: const Color(0xFF00ADB5),
                      onRefresh: _fetchMaterials,
                      child: GridView.builder(
                        padding: const EdgeInsets.all(16),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 0.72,
                        ),
                        itemCount: _materials.length,
                        itemBuilder: (context, index) {
                          return _buildMaterialCard(_materials[index]);
                        },
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
