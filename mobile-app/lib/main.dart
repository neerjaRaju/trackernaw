import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'blocs/auth_bloc.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'services/api_client.dart';
import 'services/location_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();
  await Hive.openBox('session');
  await Hive.openBox('offline_queue');
  ApiClient.init();
  LocationService.initBackground();
  runApp(const FieldForceApp());
}

class FieldForceApp extends StatelessWidget {
  
  const FieldForceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => AuthBloc()..add(AuthBootstrap()),
      child: MaterialApp(
        title: 'Field Force',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff2563eb)),
          useMaterial3: true,
        ),
        home: const SplashScreen(),
        routes: {
          '/login': (_) => const LoginScreen(),
          '/home': (_) => const DashboardScreen(),
        },
      ),
    );
  }
}
