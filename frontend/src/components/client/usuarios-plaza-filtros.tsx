'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Filtro de búsqueda por nombre/email de usuarios `admin_plaza`. Conserva el
 * tab activo en el query param al cambiar de página (default `tab=usuarios`).
 */
export function UsuariosPlazaFiltros({ search }: { search?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(search ?? '');
  const [pending, startTransition] = useTransition();

  const apply = (q: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (q) next.set('search', q);
    else next.delete('search');
    next.delete('page');
    next.set('tab', 'usuarios');
    startTransition(() => router.push(`?${next.toString()}`, { scroll: false }));
  };

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply(value.trim());
      }}
    >
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <Input
          placeholder="Buscar por nombre o email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-72 pl-7"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? 'Buscando…' : 'Buscar'}
      </Button>
      {search && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setValue('');
            apply('');
          }}
        >
          Limpiar
        </Button>
      )}
    </form>
  );
}
