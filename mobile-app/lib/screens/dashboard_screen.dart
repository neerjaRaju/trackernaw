import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../blocs/auth_bloc.dart';
import 'attendance_screen.dart';
import 'tasks_screen.dart';
import 'expenses_screen.dart';
import 'tracking_screen.dart';
import 'team_map_screen.dart';
import '../widgets/sos_button.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _idx = 0;
  final pages = const [
    AttendanceScreen(),
    TrackingScreen(),
    TeamMapScreen(),
    TasksScreen(),
    ExpensesScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Field Force'),
        actions: [
          IconButton(icon: const Icon(Icons.logout), onPressed: () {
            context.read<AuthBloc>().add(AuthLogout());
            Navigator.of(context).pushReplacementNamed('/login');
          }),
        ],
      ),
      body: Stack(
        children: [
          pages[_idx],
          const Positioned(bottom: 16, right: 16, child: SosButton()),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _idx,
        onDestinationSelected: (i) => setState(() => _idx = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.access_time), label: 'Attendance'),
          NavigationDestination(icon: Icon(Icons.my_location), label: 'Me'),
          NavigationDestination(icon: Icon(Icons.group), label: 'Team'),
          NavigationDestination(icon: Icon(Icons.assignment), label: 'Tasks'),
          NavigationDestination(icon: Icon(Icons.receipt), label: 'Expenses'),
        ],
      ),
    );
  }
}
