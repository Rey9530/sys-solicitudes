'use client';

import Swal, { type SweetAlertIcon, type SweetAlertResult } from 'sweetalert2';

/**
 * Wrapper de SweetAlert2 para el sistema de diseño de Plazapp.
 *
 * Toda confirmación / decisión destructiva (deshabilitar, eliminar, resetear,
 * reactivar) DEBE usar este wrapper en lugar de `window.confirm` /
 * `window.alert` nativos. Razones:
 *  - Look & feel consistente con la app (iconos, colores, focus trap, ARIA).
 *  - Bloqueable por el usuario y testeable (mocks / Vitest con `vi.mock`).
 *  - Permite distinguir `Cancelar` vs `Confirmar` con `dismiss` (ESC, click
 *    fuera, botón secundario) y `isConfirmed` con el botón primario.
 *  - Sin warnings de Next.js (los `window.confirm` y los `alert` síncronos
 *    no respetan Server Components / `'use client'` boundaries y se ejecutan
 *    en el render si se llaman desde un Client Component mal aislado).
 *
 * Convenciones:
 *  - Confirmaciones destructivas → `confirmAction({ ..., confirmButtonText: 'Sí, deshabilitar', icon: 'warning' })`.
 *  - Inputs → `promptAction({ ..., inputValidator })`.
 *  - Toasts efímeros → seguir usando `sonner` (más liviano, no modal).
 *
 * Documentado en:
 *  - docs/02-stack-tecnologico.md (UI)
 *  - docs/07-arquitectura.md (convenciones de UI)
 *  - CLAUDE.md (regla operativa)
 */
export interface ConfirmActionOptions {
  title: string;
  text?: string;
  html?: string;
  icon?: SweetAlertIcon;
  confirmButtonText?: string;
  cancelButtonText?: string;
  /** Etiqueta accesible (atributo `aria-label`). */
  customClass?: string;
  /** Foco inicial en el botón cancelar para acciones destructivas. */
  focusCancel?: boolean;
  /** Color del botón primario. Default: `var(--color-danger)` para icon=warning. */
  confirmButtonColor?: string;
}

/** Diálogo de confirmación con dos botones (Sí / No). Devuelve `true` solo si el usuario confirmó con el botón primario. */
export async function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  const {
    title,
    text,
    html,
    icon = 'warning',
    confirmButtonText = 'Confirmar',
    cancelButtonText = 'Cancelar',
    customClass,
    focusCancel = icon === 'warning' || icon === 'error',
    confirmButtonColor,
  } = options;

  const result: SweetAlertResult<unknown> = await Swal.fire({
    title,
    text,
    html,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: false,
    focusCancel,
    customClass: {
      confirmButton: 'btn btn-primary',
      cancelButton: 'btn btn-secondary',
      ...(customClass ? { popup: customClass } : {}),
    },
    buttonsStyling: false,
    ...(confirmButtonColor ? { confirmButtonColor } : {}),
    heightAuto: false,
  });
  return result.isConfirmed === true;
}

/** Diálogo de éxito. Auto-cierre opcional. */
export async function notifySuccess(title: string, text?: string, timerMs = 2200): Promise<void> {
  await Swal.fire({
    title,
    text,
    icon: 'success',
    timer: timerMs,
    timerProgressBar: true,
    showConfirmButton: false,
    buttonsStyling: false,
    customClass: { popup: 'swal2-plazapp' },
    heightAuto: false,
  });
}

/** Diálogo de error bloqueante. */
export async function notifyError(title: string, text?: string): Promise<void> {
  await Swal.fire({
    title,
    text,
    icon: 'error',
    confirmButtonText: 'Entendido',
    buttonsStyling: false,
    customClass: {
      confirmButton: 'btn btn-primary',
      popup: 'swal2-plazapp',
    },
    heightAuto: false,
  });
}
