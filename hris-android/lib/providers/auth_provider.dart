import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import '../config/api_client.dart';
import '../models/models.dart';

class AuthProvider extends ChangeNotifier {
  String? _token;
  FullEmployeeProfile? _profile;
  AttendanceRecord? _todayAttendance;
  List<AttendanceRecord> _attendanceHistory = [];
  List<LeaveRecord> _leaveHistory = [];
  List<PayrollRecord> _payrollHistory = [];
  List<SopRecord> _sopList = [];
  List<InformationRecord> _informations = [];
  List<DocumentationRecord> _documentationList = [];
  List<String> _unacknowledgedLeaveNotifications = [];
  List<String> _leaveNotificationsLog = [];
  List<dynamic> _policies = [];
  List<dynamic> _peakDays = [];
  BreakSchedule? _todayBreakSchedule;
  Timer? _notificationTimer;
  List<SanctionRecord> _sanctions = [];
  List<NotificationRecord> _notifications = [];
  List<ContractRecord> _contracts = [];
  List<QuizRecord> _quizzes = [];
  List<QuizAttemptRecord> _quizAttempts = [];

  void startNotificationTimer() {
    _notificationTimer?.cancel();
    _notificationTimer = Timer.periodic(const Duration(seconds: 10), (timer) {
      if (_token != null) {
        fetchLeaveHistory();
        fetchNotifications();
        fetchSanctions();
        fetchTodayBreakSchedule();
        fetchPayrollHistory();
        fetchQuizzes();
        fetchQuizAttempts();
        fetchTodayAttendance();
        fetchAttendanceHistory();
      } else {
        timer.cancel();
      }
    });
  }

  void stopNotificationTimer() {
    _notificationTimer?.cancel();
    _notificationTimer = null;
  }

  bool _isLoading = false;
  String? _errorMessage;
  String? _successMessage;
  String? _attendanceError;
  String? _attendanceSuccess;
  bool _connectionError = false;

  // Getters
  String? get token => _token;
  bool get isAuthenticated => _token != null;
  FullEmployeeProfile? get profile => _profile;
  AttendanceRecord? get todayAttendance => _todayAttendance;
  List<AttendanceRecord> get attendanceHistory => _attendanceHistory;
  List<LeaveRecord> get leaveHistory => _leaveHistory;
  List<PayrollRecord> get payrollHistory => _payrollHistory;
  List<SopRecord> get sopList => _sopList;
  List<InformationRecord> get informations => _informations;
  List<DocumentationRecord> get documentationList => _documentationList;
  List<String> get unacknowledgedLeaveNotifications => _unacknowledgedLeaveNotifications;
  List<String> get leaveNotificationsLog => _leaveNotificationsLog;
  List<SanctionRecord> get sanctions => _sanctions;
  List<NotificationRecord> get notifications => _notifications;
  List<ContractRecord> get contracts => _contracts;
  List<NotificationRecord> get unreadNotifications => _notifications.where((n) => !n.isRead).toList();
  List<dynamic> get policies => _policies;
  List<dynamic> get peakDays => _peakDays;
  BreakSchedule? get todayBreakSchedule => _todayBreakSchedule;
  List<QuizRecord> get quizzes => _quizzes;
  List<QuizAttemptRecord> get quizAttempts => _quizAttempts;

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String? get successMessage => _successMessage;
  String? get attendanceError => _attendanceError;
  String? get attendanceSuccess => _attendanceSuccess;
  bool get connectionError => _connectionError;

  /// Hanya set connectionError=true jika BENAR-BENAR terjadi kegagalan jaringan
  /// (SocketException, Timeout, HandshakeException, dsb).
  /// HTTP 4xx/5xx dari server BUKAN network error — jangan tampilkan layar disconnect.
  void _handleConnectionError(dynamic e, String method) {
    print('$method Connection Error: $e');
    final errStr = e.toString().toLowerCase();
    final isNetworkException = errStr.contains('socketexception') ||
        errStr.contains('timeoutexception') ||
        errStr.contains('clientexception') ||
        errStr.contains('connection failed') ||
        errStr.contains('handshakeexception') ||
        errStr.contains('connection refused') ||
        errStr.contains('network is unreachable') ||
        errStr.contains('failed host lookup');

    // Hanya tampilkan layar disconnect jika jaringan benar-benar tidak tersedia
    if (isNetworkException) {
      _connectionError = true;
      _errorMessage = 'Gagal menghubungkan ke server API backend.';
    }
    notifyListeners();
  }

  AuthProvider() {
    // Daftarkan callback global ApiClient agar ketika mendeteksi 401/403 otomatis melalukan logout ke Login Screen
    ApiClient.onUnauthorized = () {
      logoutWithMessage("Sesi Anda telah berakhir. Silakan login kembali menggunakan akun Barokah Grup Anda!");
    };
    _loadSession();
  }

  Future<void> _loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    String? savedToken = prefs.getString('auth_token') ?? prefs.getString('token');
    String? userJson = prefs.getString('user_profile');

    final rawNotifs = prefs.getString('hris_unacknowledged_leave_notifications') ?? '[]';
    try {
      final List<dynamic> parsed = jsonDecode(rawNotifs);
      _unacknowledgedLeaveNotifications = parsed.map((e) => e.toString()).toList();
    } catch (_) {}

    final rawLog = prefs.getString('hris_leave_notifications_log') ?? '[]';
    try {
      final List<dynamic> parsed = jsonDecode(rawLog);
      _leaveNotificationsLog = parsed.map((e) => e.toString()).toList();
    } catch (_) {}

    if (savedToken != null && userJson != null) {
      _token = savedToken;
      _profile = FullEmployeeProfile.fromJson(jsonDecode(userJson));
      notifyListeners();
      fetchInitialData();
    }
  }

  Future<void> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiClient.post('auth/login', {
        'email': email.trim(),
        'password': password,
        'client': 'mobile',
      }).timeout(const Duration(seconds: 10));

      final data = jsonDecode(res.body);
      _isLoading = false;

      if (res.statusCode == 200 && (data['success'] == true || data['status'] == 'success')) {
        final resData = data['data'] ?? {};
        final tokenObj = resData['token'] ?? data['token'];
        _token = tokenObj;
        
        final userMap = resData['user'] ?? data['user'] ?? {};
        _profile = FullEmployeeProfile(
          id: userMap['id'] as int? ?? 9999,
          email: userMap['email'] as String? ?? email.trim(),
          role: userMap['role'] as String? ?? 'Karyawan',
          fullName: userMap['fullName'] as String? ?? userMap['full_name'] as String? ?? email.trim(),
          employeeId: userMap['employeeId'] as int? ?? userMap['employee_id'] as int? ?? 9999,
          position: userMap['position'] as String? ?? 'Staff',
          department: userMap['department'] as String? ?? 'Operasional',
          outlet: userMap['outlet'] as String? ?? 'PUSAT',
        );

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', _token!);
        await prefs.setString('token', _token!);
        await prefs.setString('user_profile', jsonEncode({
          'id': _profile!.id,
          'email': _profile!.email,
          'role': _profile!.role,
          'employee_id': _profile!.employeeId,
          'full_name': _profile!.fullName,
          'position': _profile!.position,
          'department': _profile!.department,
          'outlet': _profile!.outlet,
        }));

        // Cache offline credentials
        await prefs.setString('hris_offline_user_${email.trim()}', jsonEncode({
          'password': password,
          'user': {
            'id': _profile!.id,
            'email': _profile!.email,
            'role': _profile!.role,
            'employee_id': _profile!.employeeId,
            'full_name': _profile!.fullName,
            'position': _profile!.position,
            'department': _profile!.department,
            'outlet': _profile!.outlet,
          }
        }));

        notifyListeners();
        fetchInitialData();
      } else {
        _errorMessage = data['message'] ?? 'Username atau Password salah.';
        notifyListeners();
      }
    } catch (e) {
      // Offline Savior Fallback
      final cleanUsername = email.trim();
      final prefs = await SharedPreferences.getInstance();
      final offlineDataStr = prefs.getString('hris_offline_user_$cleanUsername');
      _isLoading = false;
      if (offlineDataStr != null) {
        try {
          final offlineData = jsonDecode(offlineDataStr);
          final cachedPassword = offlineData['password'] as String;
          if (cachedPassword == password) {
            final userMap = offlineData['user'] ?? {};
            _token = 'OfflineSession-$cleanUsername';
            _profile = FullEmployeeProfile(
              id: userMap['id'] as int? ?? 9999,
              email: userMap['email'] as String? ?? '${cleanUsername.toLowerCase()}@barokah.com',
              role: userMap['role'] as String? ?? 'Karyawan',
              fullName: userMap['full_name'] as String? ?? userMap['fullName'] as String? ?? cleanUsername,
              employeeId: userMap['employee_id'] as int? ?? userMap['employeeId'] as int? ?? 9999,
              position: userMap['position'] as String? ?? 'Staff',
              department: userMap['department'] as String? ?? 'Operasional',
              outlet: userMap['outlet'] as String? ?? 'PUSAT',
            );

            await prefs.setString('auth_token', _token!);
            await prefs.setString('token', _token!);
            await prefs.setString('user_profile', jsonEncode({
              'id': _profile!.id,
              'email': _profile!.email,
              'role': _profile!.role,
              'employee_id': _profile!.employeeId,
              'full_name': _profile!.fullName,
              'position': _profile!.position,
              'department': _profile!.department,
              'outlet': _profile!.outlet,
            }));

            notifyListeners();
            return;
          } else {
            _errorMessage = 'Username atau Password Salah (Mode Offline)';
            notifyListeners();
            return;
          }
        } catch (_) {}
      }
      _errorMessage = 'Gagal menghubungkan ke server API backend.';
      notifyListeners();
    }
  }

  Future<void> fetchInitialData() async {
    if (_token == null) return;
    startNotificationTimer();
    _isLoading = true;
    _connectionError = false;
    notifyListeners();
    try {
      await Future.wait([
        fetchProfile(),
        fetchTodayAttendance(),
        fetchTodayBreakSchedule(),
        fetchAttendanceHistory(),
        fetchLeaveHistory(),
        fetchPayrollHistory(),
        fetchSops(),
        fetchInformations(),
        fetchDocumentations(),
        fetchPolicies(),
        fetchPeakDays(),
        fetchSanctions(),
        fetchNotifications(),
        fetchContracts(),
        fetchQuizzes(),
        fetchQuizAttempts(),
      ]);
    } catch (e) {
      // Hanya set connectionError jika ini benar-benar kegagalan jaringan
      final errStr = e.toString().toLowerCase();
      final isNetworkException = errStr.contains('socketexception') ||
          errStr.contains('timeoutexception') ||
          errStr.contains('clientexception') ||
          errStr.contains('connection failed') ||
          errStr.contains('handshakeexception') ||
          errStr.contains('connection refused') ||
          errStr.contains('network is unreachable') ||
          errStr.contains('failed host lookup');
      if (isNetworkException) {
        _connectionError = true;
      }
      print('FetchInitialData Error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchProfile() async {
    try {
      final res = await ApiClient.get('auth/me', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        _profile = FullEmployeeProfile.fromJson(data['data']['user']);
        // Koneksi berhasil — pastikan connectionError di-reset
        _connectionError = false;
        notifyListeners();
      } else {
        // HTTP error (401/403/500) — jangan tampilkan disconnect screen
        print('FetchProfile HTTP ${res.statusCode}: ${res.body}');
      }
    } catch (e) {
      // Hanya tampilkan disconnect screen untuk error jaringan
      _handleConnectionError(e, 'FetchProfile');
    }
  }

  Future<void> fetchTodayAttendance() async {
    try {
      final res = await ApiClient.get('attendance/today', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success' && data['data'] != null) {
        final rawData = data['data'];
        if (rawData is Map) {
          _todayAttendance = AttendanceRecord.fromJson(Map<String, dynamic>.from(rawData));
        } else {
          _todayAttendance = null;
        }
      } else {
        _todayAttendance = null;
      }
      notifyListeners();
    } catch (e) {
      _handleConnectionError(e, 'FetchTodayAttendance');
    }
  }

  Future<void> fetchAttendanceHistory() async {
    try {
      final res = await ApiClient.get('attendance/history', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        final List list = data['data'] ?? [];
        _attendanceHistory = list.map((x) => AttendanceRecord.fromJson(x)).toList();
        notifyListeners();
      }
    } catch (e) {
      _handleConnectionError(e, 'FetchAttendanceHistory');
    }
  }

  Future<void> clockIn(double lat, double lng, {String? notes}) async {
    _isLoading = true;
    _attendanceError = null;
    _attendanceSuccess = null;
    notifyListeners();

    try {
      final Map<String, dynamic> payload = {
        'latitude': lat,
        'longitude': lng,
      };
      if (notes != null && notes.isNotEmpty) {
        payload['notes'] = notes;
      }

      final res = await ApiClient.post('attendance/clock-in', payload, token: _token);
      final data = jsonDecode(res.body);
      _isLoading = false;

      if (res.statusCode == 200 && data['status'] == 'success') {
        _attendanceSuccess = data['message'] ?? 'Absensi Clock-In berhasil dicatat!';
        fetchTodayAttendance();
        fetchAttendanceHistory();
      } else {
        _attendanceError = data['message'] ?? 'Gagal memproses Clock-In.';
      }
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _attendanceError = 'Koneksi GPS/API Server terganggu.';
      notifyListeners();
    }
  }

  Future<void> clockOut(double lat, double lng) async {
    _isLoading = true;
    _attendanceError = null;
    _attendanceSuccess = null;
    notifyListeners();

    try {
      final res = await ApiClient.post('attendance/clock-out', {
        'latitude': lat,
        'longitude': lng,
      }, token: _token);

      final data = jsonDecode(res.body);
      _isLoading = false;

      if (res.statusCode == 200 && data['status'] == 'success') {
        _attendanceSuccess = data['message'] ?? 'Absensi Clock-Out berhasil dicatat!';
        fetchTodayAttendance();
        fetchAttendanceHistory();
      } else {
        _attendanceError = data['message'] ?? 'Gagal memproses Clock-Out.';
      }
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _attendanceError = 'Koneksi GPS/API Server terganggu.';
      notifyListeners();
    }
  }

  Future<void> fetchTodayBreakSchedule() async {
    try {
      final res = await ApiClient.get('attendance/break-schedule', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success' && data['data'] != null) {
        final rawData = data['data'];
        if (rawData is List) {
          if (rawData.isNotEmpty) {
            final int? empId = _profile?.employeeId;
            var matchedItem = rawData.firstWhere(
              (x) => x is Map && x['employee_id'] == empId,
              orElse: () => rawData.first,
            );
            if (matchedItem is Map) {
              _todayBreakSchedule = BreakSchedule.fromJson(Map<String, dynamic>.from(matchedItem));
            } else {
              _todayBreakSchedule = null;
            }
          } else {
            _todayBreakSchedule = null;
          }
        } else if (rawData is Map) {
          _todayBreakSchedule = BreakSchedule.fromJson(Map<String, dynamic>.from(rawData));
        } else {
          _todayBreakSchedule = null;
        }
      } else {
        _todayBreakSchedule = null;
      }
      notifyListeners();
    } catch (e) {
      _handleConnectionError(e, 'FetchTodayBreakSchedule');
    }
  }

  Future<void> startBreak() async {
    _isLoading = true;
    _attendanceError = null;
    _attendanceSuccess = null;
    notifyListeners();

    try {
      final res = await ApiClient.post('attendance/break-start', {}, token: _token);
      final data = jsonDecode(res.body);
      _isLoading = false;

      if (res.statusCode == 200 && data['status'] == 'success') {
        _attendanceSuccess = data['message'] ?? 'Waktu istirahat berhasil dimulai.';
        await fetchTodayAttendance();
        await fetchAttendanceHistory();
      } else {
        _attendanceError = data['message'] ?? 'Gagal mencatat mulai istirahat.';
      }
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _attendanceError = 'Koneksi ke API Server terganggu.';
      notifyListeners();
    }
  }

  Future<void> endBreak() async {
    _isLoading = true;
    _attendanceError = null;
    _attendanceSuccess = null;
    notifyListeners();

    try {
      final res = await ApiClient.post('attendance/break-end', {}, token: _token);
      final data = jsonDecode(res.body);
      _isLoading = false;

      if (res.statusCode == 200 && data['status'] == 'success') {
        _attendanceSuccess = data['message'] ?? 'Waktu istirahat berhasil diselesaikan.';
        await fetchTodayAttendance();
        await fetchAttendanceHistory();
      } else {
        _attendanceError = data['message'] ?? 'Gagal mencatat selesai istirahat.';
      }
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _attendanceError = 'Koneksi ke API Server terganggu.';
      notifyListeners();
    }
  }

  Future<void> fetchBreakHistory() async {
    await fetchAttendanceHistory();
  }

  Future<void> submitFormPengajuan(String type, String start, String end, String reason, {String? halfDayClockOut, double? cashAdvanceAmount}) async {
    _isLoading = true;
    _successMessage = null;
    _errorMessage = null;
    notifyListeners();

    try {
      final Map<String, dynamic> body = {
        'leave_type': type,
        'start_date': start,
        'end_date': end,
        'reason': reason,
      };
      if (halfDayClockOut != null) {
        body['half_day_clock_out'] = halfDayClockOut;
      }
      if (cashAdvanceAmount != null) {
        body['cash_advance_amount'] = cashAdvanceAmount;
      }

      final res = await ApiClient.post('pengajuan/submit', body, token: _token);

      final data = jsonDecode(res.body);
      _isLoading = false;

      if ((res.statusCode == 201 || res.statusCode == 200) && data['status'] == 'success') {
        _successMessage = data['message'] ?? 'Pengajuan berhasil terkirim!';
        fetchLeaveHistory();
      } else {
        _errorMessage = data['message'] ?? 'Gagal memproses pengajuan.';
      }
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _errorMessage = 'Gagal menghubungkan ke server API backend.';
      notifyListeners();
    }
  }

  Future<void> submitLeave(String type, String start, String end, String reason, {String? halfDayClockOut, double? cashAdvanceAmount}) async {
    await submitFormPengajuan(type, start, end, reason, halfDayClockOut: halfDayClockOut, cashAdvanceAmount: cashAdvanceAmount);
  }

  Future<void> fetchLeaveHistory() async {
    try {
      final res = await ApiClient.get('leaves', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        final List list = data['data'] ?? [];
        final newLeaves = list.map((x) => LeaveRecord.fromJson(x)).toList();

        final prefs = await SharedPreferences.getInstance();
        final rawStatuses = prefs.getString('hris_leave_statuses') ?? '{}';
        final Map<String, dynamic> storedStatuses = jsonDecode(rawStatuses);

        final rawNotifs = prefs.getString('hris_unacknowledged_leave_notifications') ?? '[]';
        final List<dynamic> storedNotifs = jsonDecode(rawNotifs);
        final List<String> activeNotifs = storedNotifs.map((e) => e.toString()).toList();

        final rawLog = prefs.getString('hris_leave_notifications_log') ?? '[]';
        final List<dynamic> storedLog = jsonDecode(rawLog);
        final List<String> logNotifs = storedLog.map((e) => e.toString()).toList();

        const Map<String, String> leaveTypeLabels = {
          'cuti': 'Libur Reguler',
          'sakit': 'Sakit',
          'izin': 'Izin',
          'setengah_hari': 'Masuk Setengah Hari',
          'kasbon': 'Kasbon',
        };

        bool hasChanges = false;

        for (var lv in newLeaves) {
          final key = lv.id.toString();
          final oldStatus = storedStatuses[key];

          if (oldStatus != null && oldStatus == 'pending' && lv.status != 'pending') {
            String? msg;
            final label = leaveTypeLabels[lv.leaveType] ?? lv.leaveType;
            if (lv.status == 'approved') {
              if (lv.leaveType == 'kasbon') {
                final amountVal = lv.cashAdvanceAmount ?? 0.0;
                final cleanAmount = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp', decimalDigits: 0).format(amountVal);
                msg = "🟢 Pengajuan Kasbon Anda sebesar $cleanAmount telah DISETUJUI. Dana langsung tercatat memotong gaji periode berjalan.";
              } else {
                msg = "🟢 Pengajuan $label Anda pada tanggal ${lv.startDate} telah DISETUJUI oleh Manajemen.";
              }
            } else if (lv.status == 'rejected') {
              if (lv.leaveType == 'kasbon') {
                final amountVal = lv.cashAdvanceAmount ?? 0.0;
                final cleanAmount = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp', decimalDigits: 0).format(amountVal);
                msg = "🔴 Pengajuan Kasbon Anda sebesar $cleanAmount DITOLAK.";
              } else {
                msg = "🔴 Pengajuan $label Anda pada tanggal ${lv.startDate} DITOLAK. Silakan hubungi Leader Anda.";
              }
            }
            if (msg != null) {
              activeNotifs.add(msg);
              logNotifs.add(msg);
              hasChanges = true;
            }
          }
          storedStatuses[key] = lv.status;
        }

        await prefs.setString('hris_leave_statuses', jsonEncode(storedStatuses));
        if (hasChanges || activeNotifs.length != _unacknowledgedLeaveNotifications.length) {
          await prefs.setString('hris_unacknowledged_leave_notifications', jsonEncode(activeNotifs));
          _unacknowledgedLeaveNotifications = activeNotifs;
        }
        if (hasChanges || logNotifs.length != _leaveNotificationsLog.length) {
          await prefs.setString('hris_leave_notifications_log', jsonEncode(logNotifs));
          _leaveNotificationsLog = logNotifs;
        }

        _leaveHistory = newLeaves;
        notifyListeners();
      }
    } catch (e) {
      _handleConnectionError(e, 'FetchLeaveHistory');
    }
  }

  Future<void> fetchPolicies() async {
    try {
      final res = await ApiClient.get('policies', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        _policies = data['data'] ?? [];
        notifyListeners();
      }
    } catch (e) {
      _handleConnectionError(e, 'FetchPolicies');
    }
  }

  Future<void> fetchPeakDays() async {
    try {
      final res = await ApiClient.get('policies/peak-days', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        _peakDays = data['data'] ?? [];
        notifyListeners();
      }
    } catch (e) {
      _handleConnectionError(e, 'FetchPeakDays');
    }
  }

  Future<void> acknowledgeLeaveNotifications() async {
    _unacknowledgedLeaveNotifications = [];
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('hris_unacknowledged_leave_notifications', '[]');
    notifyListeners();
  }

  Future<void> fetchPayrollHistory() async {
    try {
      final res = await ApiClient.get('payroll/mobile-slips', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        final List list = data['data'] ?? [];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('hris_payroll_mobile_slips', jsonEncode(list));
        
        // Simpan juga versi flat ke internal _payrollHistory demi kompatibilitas
        _payrollHistory = list.map((x) {
          final inc = x['income'] as Map<String, dynamic>? ?? {};
          final ded = x['deduction'] as Map<String, dynamic>? ?? {};
          return PayrollRecord(
            id: int.tryParse(x['id']?.toString() ?? '') ?? 0,
            period: '${x['tahun']}-${x['bulan']?.toString().padLeft(2, '0')}',
            basicSalary: double.tryParse(inc['gaji_pokok']?.toString() ?? '') ?? 0.0,
            allowances: double.tryParse(inc['uang_makan']?.toString() ?? '') ?? 0.0,
            deductions: double.tryParse(ded['kasbon']?.toString() ?? '') ?? 0.0,
            netSalary: double.tryParse(x['thp']?.toString() ?? '') ?? 0.0,
            paymentStatus: 'paid',
          );
        }).toList();
        
        notifyListeners();
      }
    } catch (e) {
      _handleConnectionError(e, 'FetchPayrollHistory');
    }
  }

  Future<void> fetchSops() async {
    try {
      final res = await ApiClient.get('sops', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        final List list = data['data'] ?? [];
        _sopList = list.map((x) => SopRecord.fromJson(x)).toList();
        notifyListeners();
      }
    } catch (e) {
      _handleConnectionError(e, 'FetchSops');
    }
  }

  Future<void> fetchInformations() async {
    try {
      final res = await ApiClient.get('informations', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        final List list = data['data'] ?? [];
        _informations = list.map((x) => InformationRecord.fromJson(x)).toList();
        notifyListeners();
      }
    } catch (e) {
      _handleConnectionError(e, 'FetchInformations');
    }
  }

  Future<void> markInformationRead(int id, String response) async {
    try {
      final res = await ApiClient.post('informations/$id/read', {
        'response': response,
      }, token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        fetchInformations();
      }
    } catch (e) {
      print('MarkInformationRead Error: $e');
    }
  }

  Future<void> fetchDocumentations() async {
    try {
      final res = await ApiClient.get('documentations', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        final List list = data['data'] ?? [];
        _documentationList = list.map((x) => DocumentationRecord.fromJson(x)).toList();
        notifyListeners();
      }
    } catch (e) {
      _handleConnectionError(e, 'FetchDocumentations');
    }
  }

  void clearMessages() {
    _errorMessage = null;
    _successMessage = null;
    _attendanceError = null;
    _attendanceSuccess = null;
    _connectionError = false;
    notifyListeners();
  }

  Future<void> logout() async {
    stopNotificationTimer();
    _token = null;
    _profile = null;
    _todayAttendance = null;
    _attendanceHistory = [];
    _leaveHistory = [];
    _payrollHistory = [];
    _sopList = [];
    _informations = [];
    _documentationList = [];
    _errorMessage = null;
    _successMessage = null;
    _attendanceError = null;
    _attendanceSuccess = null;
    _connectionError = false;
    
    _sanctions = [];
    _notifications = [];
    _contracts = [];
    _quizzes = [];
    _quizAttempts = [];
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('token');
    await prefs.remove('user_profile');
    notifyListeners();
  }

  Future<void> logoutWithMessage(String message) async {
    stopNotificationTimer();
    _token = null;
    _profile = null;
    _todayAttendance = null;
    _attendanceHistory = [];
    _leaveHistory = [];
    _payrollHistory = [];
    _sopList = [];
    _informations = [];
    _documentationList = [];
    _errorMessage = message;
    _successMessage = null;
    _attendanceError = null;
    _attendanceSuccess = null;
    _connectionError = false;
    
    _sanctions = [];
    _notifications = [];
    _contracts = [];
    _quizzes = [];
    _quizAttempts = [];
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('token');
    await prefs.remove('user_profile');
    notifyListeners();
  }

  Future<void> fetchSanctions() async {
    if (_token == null) return;
    try {
      final res = await ApiClient.get('sanctions', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        final List list = data['data'] ?? [];
        _sanctions = list.map((x) => SanctionRecord.fromJson(x)).toList();
        notifyListeners();
      }
    } catch (e) {
      _handleConnectionError(e, 'FetchSanctions');
    }
  }

  Future<void> fetchNotifications() async {
    if (_token == null) return;
    try {
      final res = await ApiClient.get('notifications', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        final List list = data['data'] ?? [];
        _notifications = list.map((x) => NotificationRecord.fromJson(x)).toList();
        notifyListeners();
      }
    } catch (e) {
      _handleConnectionError(e, 'FetchNotifications');
    }
  }

  Future<void> markNotificationAsRead(int id) async {
    if (_token == null) return;
    try {
      final res = await ApiClient.post('notifications/$id/read', {}, token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        // Update local state
        _notifications = _notifications.map((n) {
          if (n.id == id) {
            return NotificationRecord(
              id: n.id,
              employeeId: n.employeeId,
              outlet: n.outlet,
              title: n.title,
              message: n.message,
              type: n.type,
              isRead: true,
              createdAt: n.createdAt,
            );
          }
          return n;
        }).toList();
        notifyListeners();
      }
    } catch (e) {
      print('MarkNotificationAsRead Error: $e');
    }
  }

  Future<void> fetchContracts() async {
    if (_token == null) return;
    try {
      final res = await ApiClient.get('contracts', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        final List list = data['data'] ?? [];
        _contracts = list.map((x) => ContractRecord.fromJson(x)).toList();
        notifyListeners();
      }
    } catch (e) {
      print('FetchContracts Error: $e');
    }
  }

  Future<bool> signContract(int id) async {
    if (_token == null) return false;
    try {
      final res = await ApiClient.post('contracts/$id/sign', {}, token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        await fetchContracts();
        return true;
      }
    } catch (e) {
      print('SignContract Error: $e');
    }
    return false;
  }

  Future<void> fetchQuizzes() async {
    if (_token == null) return;
    try {
      final res = await ApiClient.get('quizzes', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        final List list = data['data'] ?? [];
        _quizzes = list.map((x) => QuizRecord.fromJson(x)).toList();
        notifyListeners();
      }
    } catch (e) {
      print('FetchQuizzes Error: $e');
    }
  }

  Future<void> fetchQuizAttempts() async {
    if (_token == null) return;
    try {
      final res = await ApiClient.get('quizzes/attempts', token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['status'] == 'success') {
        final List list = data['data'] ?? [];
        _quizAttempts = list.map((x) => QuizAttemptRecord.fromJson(x)).toList();
        notifyListeners();
      }
    } catch (e) {
      print('FetchQuizAttempts Error: $e');
    }
  }

  Future<bool> submitQuizAttempt(int quizId, dynamic answers) async {
    if (_token == null) return false;
    try {
      final res = await ApiClient.post('quizzes/attempts', {
        'quiz_id': quizId,
        'jawaban': answers,
      }, token: _token);
      final data = jsonDecode(res.body);
      if (res.statusCode == 201 && data['status'] == 'success') {
        await fetchQuizAttempts();
        return true;
      }
    } catch (e) {
      print('SubmitQuizAttempt Error: $e');
    }
    return false;
  }

  Future<void> saveDiscResultLocally(Map<String, dynamic> result) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('hris_my_disc_result', jsonEncode(result));
      notifyListeners();
    } catch (e) {
      print('Error saving DISC result locally: $e');
    }
  }
}
