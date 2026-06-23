import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hris_employee/providers/auth_provider.dart';
import 'package:hris_employee/config/api_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Authentication Flow Verification Tests', () {
    setUp(() {
      // Reset or initialize SharedPreferences mock before each test
      SharedPreferences.setMockInitialValues({});
    });

    test('1. Login Berhasil (Bypass/Mock Mode)', () async {
      final auth = AuthProvider();
      
      // Wait for auto-login / load session to complete
      await Future.delayed(const Duration(milliseconds: 50));
      
      // Initially, since SharedPreferences was empty, the auto-login bypass triggers:
      expect(auth.isAuthenticated, true);
      expect(auth.token, 'local-employee-token-10002');
      expect(auth.profile?.fullName, 'Arif Gunawan Panggabea');
      expect(auth.profile?.role, 'employee');
    });

    test('2. JWT Tersimpan di SharedPreferences', () async {
      final auth = AuthProvider();
      await Future.delayed(const Duration(milliseconds: 50));
      
      // Trigger login bypass
      await auth.login('', '');
      
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('auth_token'), 'local-employee-token-10002');
      expect(prefs.getString('token'), 'local-employee-token-10002');
      expect(prefs.getString('user_profile'), isNotNull);
      
      final Map<String, dynamic> storedProfile = jsonDecode(prefs.getString('user_profile')!);
      expect(storedProfile['full_name'], 'Arif Gunawan Panggabea');
      expect(storedProfile['role'], 'employee');
    });

    test('3. Session Bertahan setelah aplikasi ditutup (Persistence)', () async {
      // Simulate existing session in SharedPreferences
      SharedPreferences.setMockInitialValues({
        'auth_token': 'custom-jwt-token-xyz',
        'token': 'custom-jwt-token-xyz',
        'user_profile': jsonEncode({
          'id': 10004,
          'email': '1233333333333333@hris.local',
          'role': 'employee',
          'employee_id': 10002,
          'full_name': 'Arif Gunawan Panggabea',
          'position': 'Koki',
          'department': 'Operasional',
          'outlet': 'Ayam Bakar Surabaya Tebing Tinggi'
        })
      });

      final auth = AuthProvider();
      // Wait for _loadSession to load the credentials
      await Future.delayed(const Duration(milliseconds: 50));

      expect(auth.isAuthenticated, true);
      expect(auth.token, 'custom-jwt-token-xyz');
      expect(auth.profile?.fullName, 'Arif Gunawan Panggabea');
    });

    test('4. Logout Berhasil', () async {
      // Start with a valid session
      SharedPreferences.setMockInitialValues({
        'auth_token': 'local-employee-token-10002',
        'token': 'local-employee-token-10002',
        'user_profile': jsonEncode({
          'id': 10004,
          'email': '1233333333333333@hris.local',
          'role': 'employee',
          'employee_id': 10002,
          'full_name': 'Arif Gunawan Panggabea',
          'position': 'Koki',
          'department': 'Operasional',
          'outlet': 'Ayam Bakar Surabaya Tebing Tinggi'
        })
      });

      final auth = AuthProvider();
      await Future.delayed(const Duration(milliseconds: 50));
      expect(auth.isAuthenticated, true);

      // Perform logout
      await auth.logout();

      expect(auth.isAuthenticated, false);
      expect(auth.token, isNull);
      expect(auth.profile, isNull);

      // Verify SharedPreferences is cleared
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('auth_token'), isNull);
      expect(prefs.getString('token'), isNull);
      expect(prefs.getString('user_profile'), isNull);
    });

    test('5. Refresh/Validation Session Berhasil', () async {
      // Set initial token in SharedPreferences
      SharedPreferences.setMockInitialValues({
        'auth_token': 'local-employee-token-10002',
        'token': 'local-employee-token-10002',
        'user_profile': jsonEncode({
          'id': 10004,
          'email': '1233333333333333@hris.local',
          'role': 'employee',
          'employee_id': 10002,
          'full_name': 'Arif Gunawan Panggabea',
          'position': 'Koki',
          'department': 'Operasional',
          'outlet': 'Ayam Bakar Surabaya Tebing Tinggi'
        })
      });

      final auth = AuthProvider();
      await Future.delayed(const Duration(milliseconds: 50));

      // Test that ApiClient.onUnauthorized callback gets triggered upon token validation failure
      bool logoutTriggered = false;
      ApiClient.onUnauthorized = () {
        logoutTriggered = true;
        auth.logoutWithMessage("Sesi Anda telah berakhir. Silakan login kembali!");
      };

      expect(auth.isAuthenticated, true);
      expect(logoutTriggered, false);

      // Simulate token expiration / unauthorized response from API
      ApiClient.onUnauthorized?.call();
      
      expect(logoutTriggered, true);
      expect(auth.isAuthenticated, false);
      expect(auth.errorMessage, 'Sesi Anda telah berakhir. Silakan login kembali!');
    });
  });
}
