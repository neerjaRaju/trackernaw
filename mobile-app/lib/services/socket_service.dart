import 'package:hive/hive.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

/// Single shared Socket.IO connection for the app.
/// Used by both the team map (location:update events) and chat screens (chat:new).
class SocketService {
  static IO.Socket? _socket;

  static IO.Socket get instance {
    final existing = _socket;
    if (existing != null && existing.connected) return existing;

    final token = Hive.box('session').get('accessToken');
    final base = const String.fromEnvironment('SOCKET_BASE', defaultValue: 'http://10.0.2.2:4000');
    final s = IO.io(
      base,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableForceNew()
          .build(),
    );
    s.connect();
    _socket = s;
    return s;
  }

  static void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }
}
