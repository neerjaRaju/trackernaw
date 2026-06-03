import 'dart:io';
import 'package:dio/dio.dart';
import 'api_client.dart';

/// Two-step upload: presign on the API, then PUT bytes directly to S3.
/// Bytes never traverse our API server.
class UploadService {
  /// kind: one of selfie | face | receipt | sos_audio | chat | task_proof | visit
  static Future<String?> uploadFile({
    required File file,
    required String kind,
    String contentType = 'application/octet-stream',
  }) async {
    try {
      final presign = await ApiClient.dio.post('/uploads/presign', data: {
        'kind': kind,
        'contentType': contentType,
        'filename': file.path.split('/').last,
      });
      final url = presign.data['url'] as String;
      final publicUrl = presign.data['publicUrl'] as String;
      final bytes = await file.readAsBytes();

      // PUT bytes to the presigned URL (S3 in prod, /api/v1/uploads/dev/... in stub mode)
      final putDio = Dio(); // no auth headers — presigned URL carries its own auth
      await putDio.put(
        url,
        data: Stream.fromIterable([bytes]),
        options: Options(
          headers: { 'Content-Type': contentType, Headers.contentLengthHeader: bytes.length },
        ),
      );
      return publicUrl;
    } catch (e) {
      // ignore: avoid_print
      print('upload failed: $e');
      return null;
    }
  }
}
