import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:provider/provider.dart';
import 'package:hris_employee/main.dart';
import 'package:hris_employee/providers/auth_provider.dart';

void main() {
  testWidgets('App smoke test - renders login or main screen', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    
    // Build our app and trigger a frame.
    await tester.pumpWidget(const MyApp());
    await tester.pumpAndSettle();

    // Verify that it renders the main material app.
    expect(find.byType(MaterialApp), findsOneWidget);

    // Stop notification timers to prevent leaking timers in test environment
    final BuildContext context = tester.element(find.byType(MaterialApp));
    final AuthProvider authProvider = Provider.of<AuthProvider>(context, listen: false);
    authProvider.stopNotificationTimer();
  });
}
