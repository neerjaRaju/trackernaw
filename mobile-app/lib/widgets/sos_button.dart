import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../services/location_service.dart';

/// Floating SOS panic button. Hold for 1 second to confirm — prevents accidental triggers.
/// On confirm: captures location and POSTs /sos. Server broadcasts to managers.
class SosButton extends StatefulWidget {
  const SosButton({super.key});
  @override
  State<SosButton> createState() => _SosButtonState();
}

class _SosButtonState extends State<SosButton> with SingleTickerProviderStateMixin {
  late final AnimationController _ac = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..addStatusListener((s) {
      if (s == AnimationStatus.completed) _fire();
    });
  bool _sending = false;

  Future<void> _fire() async {
    if (_sending) return;
    setState(() => _sending = true);
    try {
      final pos = await LocationService.currentPosition();
      await ApiClient.dio.post('/sos', data: {
        'lat': pos.latitude,
        'lng': pos.longitude,
        'accuracy': pos.accuracy,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          backgroundColor: Colors.red,
          content: Text('SOS sent. Managers have been alerted.'),
          duration: Duration(seconds: 4),
        ));
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to send SOS — try again')),
      );
    } finally {
      _ac.reset();
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  void dispose() { _ac.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPressStart: (_) => _ac.forward(),
      onLongPressEnd: (_) {
        if (_ac.status != AnimationStatus.completed) _ac.reverse();
      },
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _ac,
            builder: (_, __) => SizedBox(
              width: 72, height: 72,
              child: CircularProgressIndicator(
                value: _ac.value,
                strokeWidth: 4,
                backgroundColor: Colors.red.withOpacity(0.2),
                valueColor: const AlwaysStoppedAnimation(Colors.red),
              ),
            ),
          ),
          Container(
            width: 56, height: 56,
            decoration: const BoxDecoration(
              color: Colors.red,
              shape: BoxShape.circle,
              boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 6, offset: Offset(0, 2))],
            ),
            child: _sending
                ? const Padding(
                    padding: EdgeInsets.all(16),
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.sos, color: Colors.white, size: 30),
          ),
        ],
      ),
    );
  }
}
