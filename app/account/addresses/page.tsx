'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, Pencil, Star } from 'lucide-react';
import { fetchAddresses, upsertAddress, deleteAddress } from '@/lib/addresses-api';
import type { Address } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const emptyForm = {
  full_name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  is_default: false,
};

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setAddresses(await fetchAddresses());
    } catch (e) {
      toast.error('Could not load addresses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (a: Address) => {
    setEditing(a);
    setForm({
      full_name: a.full_name,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2 || '',
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      is_default: a.is_default,
    });
    setOpen(true);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await upsertAddress({ id: editing?.id, ...form });
      toast.success('Address saved');
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteAddress(id);
      toast.success('Address removed');
      load();
    } catch {
      toast.error('Failed to remove');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-primary">Saved Addresses</h1>
        <Button onClick={openNew} className="gap-2 bg-primary">
          <Plus className="h-4 w-4" /> Add Address
        </Button>
      </div>

      {loading ? (
        <Loader2 className="mt-8 h-6 w-6 animate-spin text-muted-foreground" />
      ) : addresses.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No saved addresses yet.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="relative rounded-lg border border-border/60 p-4">
              {a.is_default && (
                <span className="absolute right-3 top-3 flex items-center gap-1 text-xs font-medium text-secondary">
                  <Star className="h-3 w-3 fill-secondary" /> Default
                </span>
              )}
              <p className="font-medium">{a.full_name}</p>
              <p className="text-sm text-muted-foreground">{a.phone}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} - {a.pincode}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(a)} className="gap-1">
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(a.id)}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Address' : 'Add Address'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Full name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address line 1</Label>
              <Input
                value={form.line1}
                onChange={(e) => setForm({ ...form, line1: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address line 2 (optional)</Label>
              <Input
                value={form.line2}
                onChange={(e) => setForm({ ...form, line2: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pincode</Label>
              <Input
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="is_default"
                checked={form.is_default}
                onCheckedChange={(v) => setForm({ ...form, is_default: !!v })}
              />
              <Label htmlFor="is_default" className="cursor-pointer">
                Set as default
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={onSave} disabled={saving} className="w-full bg-primary">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
