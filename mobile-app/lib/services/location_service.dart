import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:workmanager/workmanager.dart';
import 'package:hive/hive.dart';
import 'api_client.dart';

const _taskName = 'location-sync';

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      if (pos.isMocked) return Future.value(true);
      await ApiClient.dio.post('/location/update', data: {
        'lat': pos.latitude,
        'lng': pos.longitude,
        'accuracy': pos.accuracy,
        'speed': pos.speed,
        'isMoving': pos.speed > 1,
      });
    } catch (e) {
      final box = Hive.isBoxOpen('offline_queue') ? Hive.box('offline_queue') : await Hive.openBox('offline_queue');
      await box.add({'ts': DateTime.now().toIso8601String()});
    }
    return Future.value(true);
  });
}

class LocationService {
  static StreamSubscription<Position>? _sub;

  static Future<void> initBackground() async {
    await Workmanager().initialize(callbackDispatcher, isInDebugMode: false);
    await Workmanager().registerPeriodicTask(
      _taskName,
      _taskName,
      frequency: const Duration(minutes: 15),
      constraints: Constraints(networkType: NetworkType.connected),
    );
  }

  static Future<void> startForegroundTracking() async {
    final perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return;
    _sub?.cancel();
    _sub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 25,
      ),
    ).listen((pos) async {
      if (pos.isMocked) return;
      try {
        await ApiClient.dio.post('/location/update', data: {
          'lat': pos.latitude,
          'lng': pos.longitude,
          'accuracy': pos.accuracy,
          'speed': pos.speed,
          'isMoving': pos.speed > 1,
        });
      } catch (_) {}
    });
  }

  static void stopForeground() { _sub?.cancel(); _sub = null; }

  static Future<Position> currentPosition() => Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);

}
