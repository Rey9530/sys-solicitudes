import type { Metadata } from 'next';
import { ShieldOff } from 'lucide-react';
import { CargaInicialImporter } from '@/components/client/carga-inicial-importer';
import { Can } from '@/components/client/can';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Importar Excel' };

/** Carga inicial desde Excel: locales + inquilinos + contratos (PLANIFICACION/18). */
export default function ImportarContratosPage() {
  return (
    <div className="page wide">
      <PageHeader
        title="Carga inicial desde Excel"
        subtitle="Crea locales, inquilinos y contratos desde una plantilla, en un solo paso."
        breadcrumb={[{ label: 'Contratos', href: '/admin/contratos' }, { label: 'Importar Excel' }]}
      />
      <Can
        permiso="contratos.importar"
        fallback={
          <Card>
            <EmptyState
              icon={ShieldOff}
              title="Sin permiso"
              body="Tu rol no tiene el permiso para importar la carga inicial."
            />
          </Card>
        }
      >
        <CargaInicialImporter />
      </Can>
    </div>
  );
}
