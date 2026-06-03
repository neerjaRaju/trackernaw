import 'package:hive/hive.dart';
import 'api_client.dart';

class AuthService {
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await ApiClient.dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    final data = Map<String, dynamic>.from(res.data);
    final box = Hive.box('session');
    await box.put('accessToken', data['accessToken']);
    await box.put('refreshToken', data['refreshToken']);
    await box.put('user', data['user']);
    return data;
  }

  static Future<void> logout() async {
    final box = Hive.box('session');
    final refreshToken = box.get('refreshToken');
    try { await ApiClient.dio.post('/auth/logout', data: {'refreshToken': refreshToken}); } catch (_) {}
    await box.clear();
  }

  static bool get isLoggedIn => Hive.box('session').get('accessToken') != null;
  static Map? get currentUser => Hive.box('session').get('user') as Map?;
}
