import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_client.dart';
import '../services/upload_service.dart';

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});
  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  List<dynamic> _items = [];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final r = await ApiClient.dio.get('/expenses');
      setState(() => _items = r.data);
    } catch (_) {}
  }

  Future<void> _submit() async {
    final amountCtl = TextEditingController();
    final descCtl = TextEditingController();
    String category = 'travel';
    String? receiptUrl;
    String? receiptKey;
    String? ocrSummary;
    bool uploading = false;
    bool ocrLoading = false;

    await showDialog(context: context, builder: (ctx) {
      return StatefulBuilder(builder: (ctx, setLocal) {
        Future<void> snapReceipt() async {
          final picker = ImagePicker();
          final img = await picker.pickImage(source: ImageSource.camera, imageQuality: 80);
          if (img == null) return;
          setLocal(() => uploading = true);
          final url = await UploadService.uploadFile(
            file: File(img.path), kind: 'receipt', contentType: 'image/jpeg',
          );
          setLocal(() => uploading = false);
          if (url == null) return;
          // Extract key from the returned publicUrl. For S3: https://bucket.s3.region.amazonaws.com/<key>
          // For dev-stub: /uploads-dev/<key>
          final key = Uri.parse(url).path.replaceFirst('/uploads-dev/', '').replaceFirst('/', '');
          receiptUrl = url; receiptKey = key;

          // Auto-run OCR to prefill fields
          setLocal(() => ocrLoading = true);
          try {
            final r = await ApiClient.dio.post('/expenses/ocr', data: { 'key': key });
            if (r.statusCode == 200 && r.data != null) {
              final d = r.data as Map;
              if (d['total'] != null) amountCtl.text = d['total'].toString();
              if (d['vendor'] != null) descCtl.text = d['vendor'].toString();
              setLocal(() => ocrSummary = 'Auto-filled from receipt');
            } else {
              setLocal(() => ocrSummary = 'Receipt uploaded (OCR unavailable)');
            }
          } catch (_) {
            setLocal(() => ocrSummary = 'Receipt uploaded');
          } finally {
            setLocal(() => ocrLoading = false);
          }
        }

        return AlertDialog(
          title: const Text('New expense'),
          content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            DropdownButton<String>(
              value: category, isExpanded: true,
              items: const [
                DropdownMenuItem(value: 'travel', child: Text('Travel')),
                DropdownMenuItem(value: 'meal', child: Text('Meal')),
                DropdownMenuItem(value: 'fuel', child: Text('Fuel')),
                DropdownMenuItem(value: 'other', child: Text('Other')),
              ],
              onChanged: (v) => setLocal(() => category = v ?? 'travel'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: (uploading || ocrLoading) ? null : snapReceipt,
              icon: uploading || ocrLoading
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.receipt),
              label: Text(receiptUrl == null ? 'Snap receipt (auto-fill)' : 'Replace receipt'),
            ),
            if (ocrSummary != null)
              Padding(padding: const EdgeInsets.only(top: 4), child: Text(ocrSummary!, style: const TextStyle(fontSize: 12, color: Colors.green))),
            TextField(controller: amountCtl, decoration: const InputDecoration(labelText: 'Amount'), keyboardType: TextInputType.number),
            TextField(controller: descCtl, decoration: const InputDecoration(labelText: 'Description / Vendor')),
          ])),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(onPressed: () async {
              await ApiClient.dio.post('/expenses', data: {
                'category': category,
                'amount': double.tryParse(amountCtl.text) ?? 0,
                'description': descCtl.text,
                'receiptUrl': receiptUrl,
              });
              if (ctx.mounted) Navigator.pop(ctx);
              _load();
            }, child: const Text('Submit')),
          ],
        );
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView.separated(
          itemCount: _items.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (ctx, i) {
            final e = _items[i];
            return ListTile(
              leading: const Icon(Icons.receipt_long),
              title: Text('${e['category']} — ${e['amount']}'),
              subtitle: Text(e['description'] ?? ''),
              trailing: Chip(label: Text(e['status'])),
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _submit,
        child: const Icon(Icons.add),
      ),
    );
  }
}
