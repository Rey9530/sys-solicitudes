import type { FieldValues, Resolver } from 'react-hook-form';

/**
 * Envuelve un resolver de react-hook-form para que los inputs vacíos cuenten
 * como "sin valor" antes de validar.
 *
 * Los `<input>` no controlados entregan `''` cuando el usuario los deja en
 * blanco, y los schemas de `@app/contracts` rechazan `''` en campos
 * opcionales con formato (email, fecha ISO, enum, número `min(1)`). Sin este
 * envoltorio no se podía crear un inquilino, local o contrato dejando vacío
 * un campo opcional (auditoría 2026-10-27, bug B1-R3).
 *
 * - Altas: `vacio = undefined` → el campo se omite del payload.
 * - Ediciones con schemas `.nullable()`: `vacio = null` → borra el valor.
 */
export function sinVacios<TFieldValues extends FieldValues, TContext, TTransformed>(
  resolver: Resolver<TFieldValues, TContext, TTransformed>,
  vacio: null | undefined = undefined,
): Resolver<TFieldValues, TContext, TTransformed> {
  return (values, context, options) => {
    const limpio = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? vacio : v]),
    ) as TFieldValues;
    return resolver(limpio, context, options);
  };
}
