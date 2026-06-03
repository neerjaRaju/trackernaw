import { useState, useEffect } from 'react';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, Divider, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { api } from '../services/api';
import { setSession } from '../store';

export default function Login() {
  // SSO callback handoff: the backend redirects to /login#access=...&refresh=...
  const dispatchEffect = useDispatch();
  const navEffect = useNavigate();
  useEffect(() => {
    if (!window.location.hash.includes('access=')) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access = params.get('access');
    const refresh = params.get('refresh');
    if (access && refresh) {
      api.get('/users/me', { headers: { Authorization: `Bearer ${access}` } }).then((r) => {
        dispatchEffect(setSession({ accessToken: access, refreshToken: refresh, user: r.data }));
        history.replaceState(null, '', '/');
        navEffect('/');
      });
    }
  }, []);

  const [providers, setProviders] = useState<string[]>([]);
  useEffect(() => {
    api.get('/auth/sso/providers').then((r) => setProviders(r.data.providers || [])).catch(() => {});
  }, []);


  const [email, setEmail] = useState('admin@demo.test');
  const [password, setPassword] = useState('admin123');
  const [err, setErr] = useState('');
  const nav = useNavigate();
  const dispatch = useDispatch();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      dispatch(setSession(data));
      nav('/');
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Login failed');
    }
  }

  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh" bgcolor="#f5f5f9">
      <Card sx={{ width: 380 }}>
        <CardContent>
          <Typography variant="h5" mb={2}>Field Force Admin</Typography>
          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          <form onSubmit={submit}>
            <TextField label="Email" fullWidth margin="normal" value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Password" type="password" fullWidth margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>Sign in</Button>
          </form>
          {providers.length > 0 && (
            <>
              <Divider sx={{ my: 2 }}>or</Divider>
              <Stack spacing={1}>
                {providers.includes('azure') && (
                  <Button variant="outlined" fullWidth href="/api/v1/auth/sso/azure">
                    Sign in with Microsoft / Azure AD
                  </Button>
                )}
                {providers.includes('salesforce') && (
                  <Button variant="outlined" fullWidth href="/api/v1/auth/sso/salesforce">
                    Sign in with Salesforce
                  </Button>
                )}
              </Stack>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
