import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_client.dart';
import '../services/location_service.dart';
import '../services/upload_service.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});
  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  Map? _today;
  bool _loading = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final r = await ApiClient.dio.get('/attendance/today');
      setState(() => _today = r.data is Map ? Map.from(r.data) : null);
    } catch (_) {}
  }

  Future<void> _checkIn() async {
    setState(() => _loading = true);
    try {
      final pos = await LocationService.currentPosition();
      final picker = ImagePicker();
      final selfie = await picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 70,
      );
      if (selfie == null) {
        setState(() => _loading = false);
        return;
      }

      // Upload selfie to S3 via presigned URL before submitting check-in.
      final selfieUrl = await UploadService.uploadFile(
        file: File(selfie.path),
        kind: 'selfie',
        contentType: 'image/jpeg',
      );
      if (selfieUrl == null) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Selfie upload failed. Try again.')),
        );
        return;
      }

      try {
        await ApiClient.dio.post('/attendance/checkin', data: {
          'lat': pos.latitude,
          'lng': pos.longitude,
          'selfieUrl': selfieUrl,
        });
        await LocationService.startForegroundTracking();
        await _load();
      } catch (e) {
        if (mounted) {
          final msg = e.toString().contains('FACE_MISMATCH')
              ? 'Face verification failed — selfie does not match enrolled photo'
              : 'Check-in failed';
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
        }
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _checkOut() async {
    setState(() => _loading = true);
    try {
      final pos = await LocationService.currentPosition();
      await ApiClient.dio.post('/attendance/checkout', data: {
        'lat': pos.latitude,
        'lng': pos.longitude,
      });
      LocationService.stopForeground();
      await _load();
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final checkedIn = _today != null && _today!['checkInAt'] != null && _today!['checkOutAt'] == null;
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Today', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('Check-in: ${_today?['checkInAt'] ?? '—'}'),
                  Text('Check-out: ${_today?['checkOutAt'] ?? '—'}'),
                  Text('Within geofence: ${_today?['withinGeofence'] ?? false}'),
                ],
              ),
            ),
          ),
          const Spacer(),
          FilledButton.icon(
            onPressed: _loading ? null : (checkedIn ? _checkOut : _checkIn),
            icon: Icon(checkedIn ? Icons.logout : Icons.camera_alt),
            label: Text(_loading ? '...' : (checkedIn ? 'Check Out' : 'Check In with Selfie')),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
          ),
        ],
      ),
    );
  }
}
