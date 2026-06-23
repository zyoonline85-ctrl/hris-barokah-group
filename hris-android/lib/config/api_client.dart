import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  static String defaultBaseUrl = 'https://api.barokahgroupindonesia.tech/api';
  static String? _customBaseUrl;
  static bool isTabletEdition = false;

  static Future<String> getBaseUrl() async {
    if (_customBaseUrl != null) return _customBaseUrl!;
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedUrl = prefs.getString('custom_api_url');
      if (savedUrl != null && savedUrl.isNotEmpty) {
        _customBaseUrl = savedUrl;
        return savedUrl;
      }
    } catch (e) {
      print('ApiClient: Gagal membaca custom_api_url: $e');
    }
    return defaultBaseUrl;
  }

  static Future<void> setCustomBaseUrl(String url) async {
    String cleanUrl = url.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.substring(0, cleanUrl.length - 1);
    }
    if (!cleanUrl.endsWith('/api') && !cleanUrl.contains('/api/')) {
      cleanUrl = '$cleanUrl/api';
    }
    _customBaseUrl = cleanUrl;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('custom_api_url', cleanUrl);
  }

  static Future<void> resetCustomBaseUrl() async {
    _customBaseUrl = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('custom_api_url');
  }

  static String get baseUrl {
    return _customBaseUrl ?? defaultBaseUrl;
  }

  // Callback statis yang akan di-register oleh AuthProvider untuk melempar user ke login
  static Function()? onUnauthorized;

  static Future<Map<String, String>> getHeaders(String? token) async {
    final headers = {
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': 'true',
    };

    String? activeToken = token;
    // Jika token tidak disertakan atau masih menggunakan token pengujian default, coba ambil dari SharedPreferences
    if (activeToken == null || activeToken == 'MockToken') {
      try {
        final prefs = await SharedPreferences.getInstance();
        activeToken = prefs.getString('auth_token') ?? prefs.getString('token');
      } catch (e) {
        print('ApiClient: Gagal membaca token dari SharedPreferences: $e');
      }
    }

    if (activeToken != null && activeToken.isNotEmpty) {
      String cleanToken = activeToken;
      // Pastikan format header Authorization adalah 'Bearer <token>'
      if (cleanToken.startsWith('Bearer ')) {
        cleanToken = cleanToken.substring(7);
      }
      headers['Authorization'] = 'Bearer $cleanToken';
    }

    return headers;
  }

  // Interseptor untuk memeriksa respons error autentikasi
  static void _handleResponse(http.Response response) {
    if (response.statusCode == 401 || response.statusCode == 403) {
      onUnauthorized?.call();
    } else {
      try {
        final data = jsonDecode(response.body);
        if (data is Map && data['message'] != null) {
          final msg = data['message'].toString();
          if (msg.contains('Akses ditolak') || msg.contains('Token autentikasi tidak disertakan')) {
            onUnauthorized?.call();
          }
        }
      } catch (_) {
        // Bukan response JSON atau tidak memiliki field message
      }
    }
  }

  static Future<http.Response> _requestWithRetry(
    Future<http.Response> Function() requestFn, {
    int maxRetries = 3,
    Duration delay = const Duration(seconds: 2),
  }) async {
    int attempts = 0;
    while (true) {
      attempts++;
      try {
        return await requestFn().timeout(const Duration(seconds: 15));
      } catch (e) {
        print('ApiClient Network Error (attempt $attempts/$maxRetries): $e');
        if (attempts >= maxRetries) {
          rethrow;
        }
        await Future.delayed(delay);
      }
    }
  }

  static Future<http.Response> post(String endpoint, Map<String, dynamic> body, {String? token}) async {
    final url = Uri.parse('$baseUrl/$endpoint');
    final headers = await getHeaders(token);
    final response = await _requestWithRetry(() => http.post(
      url,
      headers: headers,
      body: jsonEncode(body),
    ));
    _handleResponse(response);
    return response;
  }

  static Future<http.Response> get(String endpoint, {String? token}) async {
    final url = Uri.parse('$baseUrl/$endpoint');
    final headers = await getHeaders(token);
    final response = await _requestWithRetry(() => http.get(
      url,
      headers: headers,
    ));
    _handleResponse(response);
    return response;
  }

  static Future<http.Response> put(String endpoint, Map<String, dynamic> body, {String? token}) async {
    final url = Uri.parse('$baseUrl/$endpoint');
    final headers = await getHeaders(token);
    final response = await _requestWithRetry(() => http.put(
      url,
      headers: headers,
      body: jsonEncode(body),
    ));
    _handleResponse(response);
    return response;
  }
}
