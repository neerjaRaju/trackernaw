import { useEffect, useState } from 'react';
import { Box, Card, Typography } from '@mui/material';
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';
import { useSelector } from 'react-redux';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import type { RootState } from '../store';

type Ping = { userId: string; lat: number; lng: number; recordedAt: string };

export default function LiveMap() {
  const [pings, setPings] = useState<Record<string, Ping>>({});
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY || '',
  });

  useEffect(() => {
    api.get('/location/live').then((r) => {
      const map: Record<string, Ping> = {};
      (r.data as Ping[]).forEach((p) => { map[p.userId] = p; });
      setPings(map);
    });
    if (!token) return;
    const socket = getSocket(token);
    const handler = (p: Ping) => setPings((cur) => ({ ...cur, [p.userId]: p }));
    socket.on('location:update', handler);
    socket.on('location:stream', handler);
    return () => { socket.off('location:update', handler); socket.off('location:stream', handler); };
  }, [token]);

  const markers = Object.values(pings);
  const center = markers[0] ? { lat: markers[0].lat, lng: markers[0].lng } : { lat: 28.6139, lng: 77.209 };

  return (
    <Box>
      <Typography variant="h4" mb={2}>Live Map ({markers.length} online)</Typography>
      <Card sx={{ height: '70vh' }}>
        {isLoaded ? (
          <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={center} zoom={12}>
            {markers.map((m) => (
              <Marker key={m.userId} position={{ lat: m.lat, lng: m.lng }} />
            ))}
          </GoogleMap>
        ) : (
          <Box p={4}>Loading Google Maps... (set VITE_GOOGLE_MAPS_KEY in admin-panel/.env)</Box>
        )}
      </Card>
    </Box>
  );
}
