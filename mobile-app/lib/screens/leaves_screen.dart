import 'package:flutter/material.dart';
import '../services/api_client.dart';

class LeavesScreen extends StatefulWidget {
  const LeavesScreen({super.key});
  @override
  State<LeavesScreen> createState() => _LeavesScreenState();
}

class _LeavesScreenState extends State<LeavesScreen> {
  List<dynamic> _leaves = [];
  List<dynamic> _balance = [];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final r1 = await ApiClient.dio.get('/leaves');
    final r2 = await ApiClient.dio.get('/leaves/balance');
    setState(() { _leaves = r1.data; _balance = r2.data; });
  }

  Future<void> _apply() async {
    String type = 'CASUAL';
    DateTime start = DateTime.now();
    DateTime end = DateTime.now();
    final reasonCtl = TextEditingController();

    await showDialog(context: context, builder: (ctx) {
      return StatefulBuilder(builder: (ctx, setLocal) => AlertDialog(
        title: const Text('Apply for leave'),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          DropdownButton<String>(
            value: type, isExpanded: true,
            items: const [
              DropdownMenuItem(value: 'CASUAL', child: Text('Casual')),
              DropdownMenuItem(value: 'SICK', child: Text('Sick')),
              DropdownMenuItem(value: 'EARNED', child: Text('Earned')),
              DropdownMenuItem(value: 'UNPAID', child: Text('Unpaid')),
              DropdownMenuItem(value: 'COMP_OFF', child: Text('Comp off')),
            ],
            onChanged: (v) => setLocal(() => type = v ?? 'CASUAL'),
          ),
          ListTile(
            title: Text('From: ${start.toIso8601String().substring(0, 10)}'),
            trailing: const Icon(Icons.calendar_today),
            onTap: () async {
              final d = await showDatePicker(context: ctx, firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now().add(const Duration(days: 365)), initialDate: start);
              if (d != null) setLocal(() => start = d);
            },
          ),
          ListTile(
            title: Text('To: ${end.toIso8601String().substring(0, 10)}'),
            trailing: const Icon(Icons.calendar_today),
            onTap: () async {
              final d = await showDatePicker(context: ctx, firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now().add(const Duration(days: 365)), initialDate: end);
              if (d != null) setLocal(() => end = d);
            },
          ),
          TextField(controller: reasonCtl, decoration: const InputDecoration(labelText: 'Reason'), maxLines: 2),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () async {
            await ApiClient.dio.post('/leaves', data: {
              'type': type,
              'startDate': start.toIso8601String().substring(0, 10),
              'endDate': end.toIso8601String().substring(0, 10),
              'reason': reasonCtl.text,
            });
            if (ctx.mounted) Navigator.pop(ctx);
            _load();
          }, child: const Text('Submit')),
        ],
      ));
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            const Text('Balance', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            SizedBox(
              height: 80,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: _balance.map((b) => Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(b['type'], style: const TextStyle(fontSize: 12, color: Colors.grey)),
                      Text('${b['remaining']} left', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      Text('of ${b['allowance']}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                    ]),
                  ),
                )).toList(),
              ),
            ),
            const SizedBox(height: 12),
            const Text('History', style: TextStyle(fontWeight: FontWeight.bold)),
            ..._leaves.map((l) => Card(
              child: ListTile(
                leading: CircleAvatar(child: Text(l['type'].toString().substring(0, 1))),
                title: Text('${l['type']} — ${l['days']} day(s)'),
                subtitle: Text('${l['startDate'].toString().substring(0, 10)} → ${l['endDate'].toString().substring(0, 10)}'),
                trailing: Chip(label: Text(l['status'])),
              ),
            )),
            if (_leaves.isEmpty)
              const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No leave history.'))),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _apply,
        icon: const Icon(Icons.add),
        label: const Text('Apply'),
      ),
    );
  }
}
