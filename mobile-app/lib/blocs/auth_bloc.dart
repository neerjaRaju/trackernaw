import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../services/auth_service.dart';

abstract class AuthEvent extends Equatable { const AuthEvent(); @override List<Object?> get props => []; }
class AuthBootstrap extends AuthEvent {}
class AuthLogin extends AuthEvent { final String email; final String password; const AuthLogin(this.email, this.password); @override List<Object?> get props => [email, password]; }
class AuthLogout extends AuthEvent {}

abstract class AuthState extends Equatable { const AuthState(); @override List<Object?> get props => []; }
class AuthInitial extends AuthState {}
class AuthLoading extends AuthState {}
class AuthAuthenticated extends AuthState { final Map user; const AuthAuthenticated(this.user); @override List<Object?> get props => [user]; }
class AuthUnauthenticated extends AuthState {}
class AuthError extends AuthState { final String message; const AuthError(this.message); @override List<Object?> get props => [message]; }

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc() : super(AuthInitial()) {
    on<AuthBootstrap>((e, emit) {
      if (AuthService.isLoggedIn) {
        emit(AuthAuthenticated(AuthService.currentUser ?? {}));
      } else {
        emit(AuthUnauthenticated());
      }
    });
    on<AuthLogin>((e, emit) async {
      emit(AuthLoading());
      try {
        final res = await AuthService.login(e.email, e.password);
        emit(AuthAuthenticated(res['user']));
      } catch (err) {
        emit(AuthError(err.toString()));
        emit(AuthUnauthenticated());
      }
    });
    on<AuthLogout>((e, emit) async {
      await AuthService.logout();
      emit(AuthUnauthenticated());
    });
  }
}
