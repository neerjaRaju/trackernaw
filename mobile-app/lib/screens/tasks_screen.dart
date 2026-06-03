import 'package:flutter/material.dart';
import '../services/api_client.dart';

class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});
  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  List<dynamic> _tasks = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final r = await ApiClient.dio.get('/tasks');
      setState(() { _tasks = r.data; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  Future<void> _complete(String id) async {
    await ApiClient.dio.post('/tasks/$id/complete', data: {});
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        itemCount: _tasks.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (ctx, i) {
          final t = _tasks[i];
          return ListTile(
            leading: CircleAvatar(child: Text(t['priority'].toString().substring(0, 1))),
            title: Text(t['title']),
            subtitle: Text('${t['status']} • Due ${t['dueAt'] ?? '—'}'),
            trailing: t['status'] != 'COMPLETED'
                ? IconButton(icon: const Icon(Icons.check), onPressed: () => _complete(t['id']))
                : const Icon(Icons.done_all, color: Colors.green),
          );
        },
      ),
    );
  }
}
