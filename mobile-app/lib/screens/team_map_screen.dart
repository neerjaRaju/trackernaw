import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../services/api_client.dart';
import '../services/socket_service.dart';
import 'chat_screen.dart';

/// Shows every teammate in the same organization on a Google Map.
/// Markers update in real time via Socket.IO `location:update`.
/// Tapping a marker opens 1:1 chat with that teammate.
class TeamMapScreen extends StatefulWidget {
  const TeamMapScreen({super.key});
  @override
  State<TeamMapScreen> createState() => _TeamMapScreenState();
}

class _TeamMapScreenState extends State<TeamMapScreen> {
  final Map<String, _Teammate> _peers = {};
  GoogleMapController? _mapController;

  @override
  void initState() {
    super.initState();
    _loadTeammates();
    _subscribeLive();
  }

  Future<void> _loadTeammates() async {
    try {
      final r = await ApiClient.dio.get('/users/teammates');
      final list = List<Map<String, dynamic>>.from(r.data);
      setState(() {
        _peers.clear();
        for (final u in list) {
          _peers[u['id']] = _Teammate.fromJson(u);
        }
      });
    } catch (_) {}
  }

  void _subscribeLive() {
    final socket = SocketService.instance;
    socket.on('location:update', (data) {
      final m = Map<String, dynamic>.from(data);
      final id = m['userId']?.toString();
      if (id == null || !_peers.containsKey(id)) return;
      setState(() {
        _peers[id]!.lat = (m['lat'] as num?)?.toDouble();
        _peers[id]!.lng = (m['lng'] as num?)?.toDouble();
        _peers[id]!.isMoving = m['isMoving'] == true;
      });
    });
  }

  void _openChat(_Teammate peer) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ChatScreen(peerId: peer.id, peerName: peer.name),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final markers = <Marker>{};
    LatLng? firstPos;
    for (final p in _peers.values) {
      if (p.lat == null || p.lng == null) continue;
      final pos = LatLng(p.lat!, p.lng!);
      firstPos ??= pos;
      markers.add(Marker(
        markerId: MarkerId(p.id),
        position: pos,
        infoWindow: InfoWindow(
          title: p.name,
          snippet: p.isMoving ? 'Moving' : 'Idle',
          onTap: () => _openChat(p),
        ),
        onTap: () => _openChat(p),
      ));
    }

    return Scaffold(
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: firstPos ?? const LatLng(28.6139, 77.209),
              zoom: 12,
            ),
            markers: markers,
            myLocationEnabled: true,
            onMapCreated: (c) => _mapController = c,
          ),
          Positioned(
            top: 12,
            left: 12,
            right: 12,
            child: Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    const Icon(Icons.group),
                    const SizedBox(width: 8),
                    Text('${_peers.values.where((p) => p.lat != null).length} of ${_peers.length} teammates live'),
                    const Spacer(),
                    IconButton(icon: const Icon(Icons.refresh), onPressed: _loadTeammates),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 16,
            left: 16,
            right: 16,
            child: Card(
              child: SizedBox(
                height: 110,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  children: _peers.values.map((p) => GestureDetector(
                    onTap: () => _openChat(p),
                    child: Container(
                      width: 96,
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 28,
                            backgroundColor: p.lat != null ? Colors.green : Colors.grey,
                            child: Text(p.name.isEmpty ? '?' : p.name[0].toUpperCase(),
                                style: const TextStyle(color: Colors.white, fontSize: 20)),
                          ),
                          const SizedBox(height: 4),
                          Text(p.name, overflow: TextOverflow.ellipsis, maxLines: 1, style: const TextStyle(fontSize: 12)),
                          Text(p.lat != null ? 'tap to chat' : 'offline',
                              style: TextStyle(fontSize: 10, color: Colors.grey[600])),
                        ],
                      ),
                    ),
                  )).toList(),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    SocketService.instance.off('location:update');
    super.dispose();
  }
}

class _Teammate {
  final String id;
  final String name;
  final String? avatarUrl;
  final String? role;
  double? lat;
  double? lng;
  bool isMoving;

  _Teammate({required this.id, required this.name, this.avatarUrl, this.role, this.lat, this.lng, this.isMoving = false});

  factory _Teammate.fromJson(Map<String, dynamic> j) {
    final loc = j['location'];
    return _Teammate(
      id: j['id'],
      name: j['fullName'] ?? '',
      avatarUrl: j['avatarUrl'],
      role: j['role'],
      lat: loc != null ? (loc['lat'] as num?)?.toDouble() : null,
      lng: loc != null ? (loc['lng'] as num?)?.toDouble() : null,
      isMoving: loc != null && loc['isMoving'] == true,
    );
  }
}
