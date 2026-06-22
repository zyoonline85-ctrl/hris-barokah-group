import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';

class PrayerService {
  static Map<String, String>? _timings;
  static String? _currentCity;
  static String _nextPrayerName = '...';
  static String _nextPrayerTime = '00:00';
  static Duration _timeToNextPrayer = Duration.zero;
  static Timer? _timer;
  
  static Function(String)? onPrayerTimeArrived;

  static String get nextPrayerName => _nextPrayerName;
  static String get nextPrayerTime => _nextPrayerTime;
  static String get timeToNextPrayerStr {
    if (_timeToNextPrayer == Duration.zero) return '--:--:--';
    final hours = _timeToNextPrayer.inHours.toString().padLeft(2, '0');
    final minutes = (_timeToNextPrayer.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (_timeToNextPrayer.inSeconds % 60).toString().padLeft(2, '0');
    return '$hours:$minutes:$seconds';
  }

  static Future<void> init(String outlet, Function(String) callback) async {
    onPrayerTimeArrived = callback;
    
    // Parse city from outlet name (e.g. "Outlet Jakarta Barat" -> "Jakarta")
    String city = 'Jakarta';
    final normalized = outlet.toLowerCase();
    if (normalized.contains('surabaya')) {
      city = 'Surabaya';
    } else if (normalized.contains('bandung')) {
      city = 'Bandung';
    } else if (normalized.contains('semarang')) {
      city = 'Semarang';
    } else if (normalized.contains('yogyakarta') || normalized.contains('jogja')) {
      city = 'Yogyakarta';
    } else if (normalized.contains('medan')) {
      city = 'Medan';
    } else if (normalized.contains('makassar')) {
      city = 'Makassar';
    }

    _currentCity = city;
    await fetchPrayerTimes(city);
    startTimer();
  }

  static Future<void> fetchPrayerTimes(String city) async {
    try {
      final now = DateTime.now();
      final dateStr = DateFormat('dd-MM-yyyy').format(now);
      
      final url = Uri.parse(
          'https://api.aladhan.com/v1/timingsByCity/$dateStr?city=$city&country=Indonesia&method=2');
      final res = await http.get(url);
      
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final rawTimings = data['data']['timings'] as Map<String, dynamic>;
        
        // Save only main prayer times
        _timings = {
          'Subuh': rawTimings['Fajr'].toString(),
          'Dzuhur': rawTimings['Dhuhr'].toString(),
          'Ashar': rawTimings['Asr'].toString(),
          'Maghrib': rawTimings['Maghrib'].toString(),
          'Isya': rawTimings['Isha'].toString(),
        };
        print('Loaded prayer times for $city: $_timings');
      }
    } catch (e) {
      print('Error fetching prayer times: $e');
    }
  }

  static void startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_timings == null) return;
      _updateCountdown();
    });
  }

  static void _updateCountdown() {
    final now = DateTime.now();
    final todayStr = DateFormat('yyyy-MM-dd').format(now);

    DateTime? closestTime;
    String? closestName;

    _timings!.forEach((name, timeStr) {
      final parsedTime = DateFormat('yyyy-MM-dd HH:mm').parse('$todayStr $timeStr');
      
      // If time has passed today, check if it's tomorrow (add 24h)
      DateTime targetTime = parsedTime;
      if (now.isAfter(parsedTime)) {
        targetTime = parsedTime.add(const Duration(days: 1));
      }

      if (closestTime == null || targetTime.isBefore(closestTime!)) {
        closestTime = targetTime;
        closestName = name;
      }
    });

    if (closestTime != null && closestName != null) {
      _nextPrayerName = closestName!;
      _nextPrayerTime = _timings![closestName]!;
      _timeToNextPrayer = closestTime!.difference(now);

      // Check if prayer time is exactly reached (allow 2 seconds threshold)
      if (_timeToNextPrayer.inSeconds == 0) {
        // Trigger alarm
        _triggerAlarm(closestName!);
      }
    }
  }

  static void _triggerAlarm(String prayerName) {
    onPrayerTimeArrived?.call(prayerName);
    
    // Play system click/alert sounds and haptic vibration
    SystemSound.play(SystemSoundType.click);
    for (int i = 0; i < 5; i++) {
      Future.delayed(Duration(milliseconds: i * 400), () {
        HapticFeedback.vibrate();
      });
    }
  }

  static void dispose() {
    _timer?.cancel();
  }
}
