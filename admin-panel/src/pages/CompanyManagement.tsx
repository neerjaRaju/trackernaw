import { useState, useEffect } from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Paper, CircularProgress, Alert, Pagination, IconButton, Tooltip } from '@mui/material';
import { Edit, Delete, AdminPanelSettings } from '@mui/icons-material';
import { api } from '../services/api';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  logoUrl?: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  _count?: { users: number };
}

interface Admin {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyAdmins, setCompanyAdmins] = useState<Admin[]>([]);

  const [formData, setFormData] = useState({ name: '', subdomain: '', plan: 'free' });

  useEffect(() => {
    loadCompanies();
  }, [page]);

  async function loadCompanies() {
    try {
      setLoading(true);
      const { data } = await api.get(`/companies?page=${page}&limit=${limit}`);
      setCompanies(data.data);
      setTotal(data.pagination.total);
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      if (!formData.name || !formData.subdomain) {
        setError('Name and subdomain required');
        return;
      }
      await api.post('/companies', formData);
      setFormData({ name: '', subdomain: '', plan: 'free' });
      setCreateOpen(false);
      setPage(1);
      await loadCompanies();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create company');
    }
  }

  async function handleUpdate() {
    try {
      if (!selectedCompany) return;
      await api.put(`/companies/${selectedCompany.id}`, {
        name: formData.name,
        plan: formData.plan,
      });
      setEditOpen(false);
      await loadCompanies();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to update company');
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this company? This cannot be undone.')) return;
    try {
      await api.delete(`/companies/${id}`);
      await loadCompanies();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to delete company');
    }
  }

  async function loadAdmins(company: Company) {
    try {
      const { data } = await api.get(`/companies/${company.id}`);
      setCompanyAdmins(data.users || []);
      setSelectedCompany(company);
      setAdminOpen(true);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load admins');
    }
  }

  function openEdit(company: Company) {
    setSelectedCompany(company);
    setFormData({ name: company.name, subdomain: company.subdomain, plan: company.plan });
    setEditOpen(true);
  }

  if (loading && companies.length === 0) {
    return <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <h2>Companies</h2>
        <Button variant="contained" onClick={() => { setFormData({ name: '', subdomain: '', plan: 'free' }); setCreateOpen(true); }}>
          New Company
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell>Name</TableCell>
              <TableCell>Subdomain</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Users</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {companies.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.name}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{c.subdomain}</TableCell>
                <TableCell>{c.plan}</TableCell>
                <TableCell>{c._count?.users || 0}</TableCell>
                <TableCell>{c.isActive ? '🟢 Active' : '🔴 Inactive'}</TableCell>
                <TableCell>
                  <Tooltip title="Manage Admins">
                    <IconButton size="small" onClick={() => loadAdmins(c)}><AdminPanelSettings fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(c)}><Edit fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDelete(c.id)}><Delete fontSize="small" /></IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {total > limit && (
        <Box display="flex" justifyContent="center" mt={2}>
          <Pagination count={Math.ceil(total / limit)} page={page} onChange={(_, p) => setPage(p)} />
        </Box>
      )}

      {/* Create Company Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Company</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField label="Company Name" fullWidth margin="normal" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          <TextField label="Subdomain" fullWidth margin="normal" value={formData.subdomain} onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })} placeholder="company-name" />
          <FormControl fullWidth margin="normal">
            <InputLabel>Plan</InputLabel>
            <Select value={formData.plan} onChange={(e) => setFormData({ ...formData, plan: e.target.value })}>
              <MenuItem value="free">Free</MenuItem>
              <MenuItem value="pro">Pro</MenuItem>
              <MenuItem value="enterprise">Enterprise</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Company</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField label="Company Name" fullWidth margin="normal" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          <FormControl fullWidth margin="normal">
            <InputLabel>Plan</InputLabel>
            <Select value={formData.plan} onChange={(e) => setFormData({ ...formData, plan: e.target.value })}>
              <MenuItem value="free">Free</MenuItem>
              <MenuItem value="pro">Pro</MenuItem>
              <MenuItem value="enterprise">Enterprise</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdate} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>

      {/* Company Admins Dialog */}
      <Dialog open={adminOpen} onClose={() => setAdminOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Company Admins - {selectedCompany?.name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {companyAdmins.length === 0 ? (
            <Alert>No admins assigned yet</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companyAdmins.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.fullName}</TableCell>
                    <TableCell>{a.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdminOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
