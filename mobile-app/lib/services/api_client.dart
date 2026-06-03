import 'package:dio/dio.dart';
import 'package:hive/hive.dart';

class ApiClient {
  static late Dio dio;

  static void init() {
    dio = Dio(BaseOptions(
      baseUrl: const String.fromEnvironment('API_BASE', defaultValue: 'http://10.0.2.2:4000/api/v1'),
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
    ));
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = Hive.box('session').get('accessToken');
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onError: (e, handler) {
        // Could refresh token here
        handler.next(e);
      },
    ));
  }
}
