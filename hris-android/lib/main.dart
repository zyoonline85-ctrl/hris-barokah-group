import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import './providers/auth_provider.dart';
import './screens/login_screen.dart';
import './screens/main_screen.dart';
import './config/api_client.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiClient.getBaseUrl();
  if (ApiClient.isTabletEdition) {
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
  } else {
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
  }
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    const bgMain = Color(0xFF222831);      // Dark Navy Pekat
    const bgSurface = Color(0xFF393E46);   // Charcoal Dark
    const accentPrimary = Color(0xFF00ADB5); // Electric Cyan
    const textMain = Color(0xFFEEEEEE);    // Light Platinum

    return ChangeNotifierProvider(
      create: (_) => AuthProvider(),
      child: MaterialApp(
        title: ApiClient.isTabletEdition ? 'HRIS Employee (Tablet Edition)' : 'HRIS Employee',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          brightness: Brightness.dark,
          scaffoldBackgroundColor: bgMain,
          colorScheme: const ColorScheme.dark(
            primary: accentPrimary,
            background: bgMain,
            surface: bgSurface,
            onPrimary: Colors.white,
            onSurface: textMain,
            secondary: accentPrimary,
          ),
          appBarTheme: const AppBarTheme(
            backgroundColor: bgSurface,
            foregroundColor: textMain,
            elevation: 0,
            iconTheme: IconThemeData(color: textMain),
          ),
          cardColor: bgSurface,
          dividerColor: const Color(0xFF2D3238),
        ),
        home: Consumer<AuthProvider>(
          builder: (context, auth, _) {
            if (auth.isAuthenticated) {
              return const MainScreen();
            } else {
              return const LoginScreen();
            }
          },
        ),
      ),
    );
  }
}
