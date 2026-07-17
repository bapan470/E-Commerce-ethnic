'use client';

import { useState, FormEvent } from 'react';
import { MapPin, CheckCircle2, XCircle, Loader2, Truck } from 'lucide-react';
import { checkPincodeServiceability, PincodeResult } from '@/lib/pincode-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function PincodeChecker() {
  const [pincode, setPincode] = useState('');
  const [result, setResult] = useState<PincodeResult | null>(null);
  const [checking, setChecking] = useState(false);

  const onCheck = async (e: FormEvent) => {
    e.preventDefault();
    if (!pincode.trim()) return;
    setChecking(true);
    setResult(null);
    try {
      const res = await checkPincodeServiceability(pincode);
      setResult(res);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Truck className="h-4 w-4 text-secondary" />
        Check delivery availability
      </div>
      <form onSubmit={onCheck} className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter pincode"
            inputMode="numeric"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={checking || pincode.length !== 6} variant="outline">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
        </Button>
      </form>

      {result && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-md p-3 text-sm ${
            result.serviceable
              ? 'bg-secondary/10 text-secondary-foreground'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {result.serviceable ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div>
            <p className="font-medium">{result.message}</p>
            {result.serviceable && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {result.codAvailable ? 'Cash on Delivery available' : 'Prepaid orders only'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
