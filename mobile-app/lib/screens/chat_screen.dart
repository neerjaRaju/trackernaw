import 'package:flutter/material.dart';
import 'package:hive/hive.dart';
import 'package:intl/intl.dart';
import '../services/api_client.dart';
import '../services/socket_service.dart';

/// 1:1 chat with one teammate, opened from the team map.
/// Loads history via REST and listens for live `chat:new` events over Socket.IO.
class ChatScreen extends StatefulWidget {
  final String peerId;
  final String peerName;
  const ChatScreen({super.key, required this.peerId, required this.peerName});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  bool _sending = false;
  late final String _myId;

  @override
  void initState() {
    super.initState();
    final user = Hive.box('session').get('user') as Map?;
    _myId = (user?['id'] ?? '').toString();
    _load();
    _subscribe();
  }

  Future<void> _load() async {
    try {
      final r = await ApiClient.dio.get('/messages/${widget.peerId}');
      setState(() {
        _messages = List<Map<String, dynamic>>.from(r.data);
        _loading = false;
      });
      _scrollToBottom();
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _subscribe() {
    final socket = SocketService.instance;
    socket.on('chat:new', (data) {
      final m = Map<String, dynamic>.from(data);
      // Only show messages from the peer in this conversation
      if (m['senderId'] != widget.peerId) return;
      setState(() => _messages.add(m));
      _scrollToBottom();
      // Acknowledge read
      ApiClient.dio.post('/messages/${widget.peerId}/read').catchError((_) {});
    });
    socket.on('chat:sent', (data) {
      final m = Map<String, dynamic>.from(data);
      if (m['recipientId'] != widget.peerId) return;
      // Already added locally on send; no-op
    });
  }

  Future<void> _send() async {
    final body = _input.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final r = await ApiClient.dio.post('/messages', data: {
        'recipientId': widget.peerId,
        'body': body,
      });
      setState(() {
        _messages.add(Map<String, dynamic>.from(r.data));
        _input.clear();
      });
      _scrollToBottom();
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to send')),
      );
    } finally {
      setState(() => _sending = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    SocketService.instance.off('chat:new');
    SocketService.instance.off('chat:sent');
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          CircleAvatar(child: Text(widget.peerName.isEmpty ? '?' : widget.peerName[0].toUpperCase())),
          const SizedBox(width: 12),
          Text(widget.peerName),
        ]),
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.all(12),
                    itemCount: _messages.length,
                    itemBuilder: (ctx, i) {
                      final m = _messages[i];
                      final mine = m['senderId'] == _myId;
                      return Align(
                        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 4),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                          decoration: BoxDecoration(
                            color: mine ? Theme.of(context).colorScheme.primary : Colors.grey[200],
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(m['body'] ?? '',
                                  style: TextStyle(color: mine ? Colors.white : Colors.black87)),
                              const SizedBox(height: 2),
                              Text(
                                _formatTime(m['createdAt']),
                                style: TextStyle(
                                  fontSize: 10,
                                  color: mine ? Colors.white70 : Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          SafeArea(
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.grey[300]!))),
              child: Row(children: [
                Expanded(
                  child: TextField(
                    controller: _input,
                    decoration: const InputDecoration(
                      hintText: 'Type a message…',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    minLines: 1,
                    maxLines: 4,
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _sending ? null : _send,
                  icon: _sending
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.send),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(dynamic ts) {
    if (ts == null) return '';
    try {
      return DateFormat.Hm().format(DateTime.parse(ts.toString()).toLocal());
    } catch (_) { return ''; }
  }
}
