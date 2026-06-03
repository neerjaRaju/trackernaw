import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../services/location_service.dart';

class TrackingScreen extends StatefulWidget {
  const TrackingScreen({super.key});
  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  Position? _pos;
  bool _live = false;

  @override
  void initState() {
    super.initState();
    LocationService.currentPosition().then((p) => setState(() => _pos = p)).catchError((_) {});
  }

  void _toggle() {
    setState(() => _live = !_live);
    if (_live) {
      LocationService.startForegroundTracking();
    } else {
      LocationService.stopForeground();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Current Location', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('Lat: ${_pos?.latitude.toStringAsFixed(6) ?? '—'}'),
                  Text('Lng: ${_pos?.longitude.toStringAsFixed(6) ?? '—'}'),
                  Text('Accuracy: ${_pos?.accuracy.toStringAsFixed(1) ?? '—'} m'),
                ],
              ),
            ),
          ),
          const Spacer(),
          SwitchListTile(
            title: const Text('Live tracking'),
            subtitle: Text(_live ? 'Streaming every 25m of movement' : 'Off'),
            value: _live,
            onChanged: (_) => _toggle(),
          ),
        ],
      ),
    );
  }
}
