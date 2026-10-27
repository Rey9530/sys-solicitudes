import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/colores.dart';
import '../../../../core/widgets/campos.dart';
import '../../../../core/widgets/dialogos.dart';
import '../../comun/filtros.dart';
import '../../reglas_fechas.dart';
import '../../solicitudes_modelos.dart';
import 'formulario_solicitud.dart';

/// Paso 2 · "Detalles": local, título, descripción, empresa ejecutante,
/// contacto de emergencia, fechas del permiso, campos del tipo y personal.
class PasoDetalles extends StatelessWidget {
  const PasoDetalles({
    super.key,
    required this.form,
    required this.datos,
    required this.momento,
    required this.onCambio,
  });

  final FormularioSolicitud form;
  final DatosWizard datos;

  /// Momento de elaboración (fija los límites de los selectores de fecha).
  final DateTime momento;
  final VoidCallback onCambio;

  Future<void> _cambiarEmergencia(BuildContext context, bool activar) async {
    if (!activar) {
      form.esEmergencia = false;
      onCambio();
      return;
    }
    final ok = await confirmar(
      context,
      titulo: 'Modo emergencia',
      mensaje: 'Solamente tiene un máximo de 3 permisos de emergencia al mes.',
      textoConfirmar: 'Entendido',
    );
    if (!ok) return;
    form.esEmergencia = true;
    onCambio();
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final aviso = c.tono(Tono.warn).fg;
    Widget texto(
      String key,
      String label,
      String valor,
      void Function(String) alCambiar, {
      int? maxLength,
      String? hint,
      TextInputType? teclado,
      List<TextInputFormatter>? formato,
      int lineas = 1,
    }) => TextFormField(
      key: Key(key),
      initialValue: valor,
      maxLength: maxLength,
      minLines: lineas,
      maxLines: lineas == 1 ? 1 : lineas + 4,
      keyboardType: teclado,
      inputFormatters: formato,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        counterText: '',
      ),
      onChanged: (v) {
        alCambiar(v);
        onCambio();
      },
    );

    final emergencia = form.esEmergencia;
    final n = form.numAsistentes;
    // Fecha fin ∈ [inicio, máximo]; si el inicio guardado quedó fuera de rango
    // (borrador viejo) no se limita por abajo para no romper el selector.
    final ultimaFin = maxFin(form.fechaInicio, momento, emergencia);
    final inicioElegido = form.fechaInicio == null
        ? null
        : DateTime.parse('${form.fechaInicio}T00:00:00Z');
    final primeraFin =
        inicioElegido != null && !inicioElegido.isAfter(ultimaFin)
        ? inicioElegido
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CampoSelect<String>(
          key: const Key('wz-local'),
          label: 'Local *',
          valor: form.localId,
          opciones: [
            (null, 'Selecciona…'),
            for (final l in datos.locales) (l.id, l.codigo),
          ],
          onChanged: (v) {
            form.localId = v;
            onCambio();
          },
        ),
        const SizedBox(height: 14),
        texto(
          'wz-titulo',
          'Título *',
          form.titulo,
          (v) => form.titulo = v,
          maxLength: 120,
        ),
        const SizedBox(height: 14),
        texto(
          'wz-descripcion',
          'Descripción *',
          form.descripcion,
          (v) => form.descripcion = v,
          maxLength: 4000,
          lineas: 4,
        ),
        _Bloque(
          titulo: 'Datos de la empresa ejecutante',
          campos: [
            texto(
              'empresa-nombre',
              'Nombre de la empresa *',
              form.empresaNombre,
              (v) => form.empresaNombre = v,
              maxLength: 160,
              hint: 'Razón social o nombre comercial',
            ),
            texto(
              'empresa-responsable',
              'Responsable *',
              form.empresaResponsable,
              (v) => form.empresaResponsable = v,
              maxLength: 160,
              hint: 'Persona responsable en sitio',
            ),
            texto(
              'empresa-telefono',
              'Teléfono *',
              form.empresaTelefono,
              (v) => form.empresaTelefono = v,
              maxLength: 20,
              hint: '+503 7000 0000',
              teclado: TextInputType.phone,
            ),
            texto(
              'empresa-email',
              'Correo electrónico *',
              form.empresaEmail,
              (v) => form.empresaEmail = v,
              maxLength: 254,
              hint: 'contacto@empresa.com',
              teclado: TextInputType.emailAddress,
            ),
          ],
        ),
        _Bloque(
          titulo: 'Contacto en caso de emergencia',
          campos: [
            texto(
              'emergencia-contacto',
              'Persona de contacto *',
              form.emergenciaContacto,
              (v) => form.emergenciaContacto = v,
              maxLength: 160,
              hint: 'Nombre y apellido',
            ),
            texto(
              'emergencia-telefono',
              'Teléfono de emergencia *',
              form.emergenciaTelefono,
              (v) => form.emergenciaTelefono = v,
              maxLength: 20,
              hint: '+503 7000 0000',
              teclado: TextInputType.phone,
            ),
          ],
        ),
        _Bloque(
          titulo: 'Fechas del permiso',
          campos: [
            CampoFecha(
              key: const Key('wz-fecha-inicio'),
              label: 'Fecha inicio *',
              valorYmd: form.fechaInicio,
              primera: minInicio(momento, emergencia),
              ultima: maxInicio(momento, emergencia),
              onChanged: (v) {
                form.fechaInicio = v;
                onCambio();
              },
            ),
            CampoFecha(
              key: const Key('wz-fecha-fin'),
              label: 'Fecha fin *',
              valorYmd: form.fechaFin,
              primera: primeraFin,
              ultima: ultimaFin,
              onChanged: (v) {
                form.fechaFin = v;
                onCambio();
              },
            ),
            CampoHora(
              key: const Key('wz-hora-inicio'),
              label: 'Hora inicio *',
              valorHhmm: form.horaInicio,
              onChanged: (v) {
                form.horaInicio = v;
                onCambio();
              },
            ),
            CampoHora(
              key: const Key('wz-hora-fin'),
              label: 'Hora fin *',
              valorHhmm: form.horaFin,
              onChanged: (v) {
                form.horaFin = v;
                onCambio();
              },
            ),
          ],
          pie: [
            Text(
              emergencia
                  ? 'Modo emergencia activo: el inicio debe ser dentro de las '
                        'próximas 48 horas; el permiso puede durar hasta 7 días.'
                  : 'La fecha de inicio debe ser entre 48 horas y 5 días '
                        'después de este momento; el permiso puede durar hasta '
                        '7 días.',
              style: TextStyle(
                fontSize: 12,
                color: emergencia ? aviso : c.text3,
              ),
            ),
            const SizedBox(height: 4),
            _Casilla(
              key: const Key('wz-emergencia'),
              valor: emergencia,
              onChanged: (v) => _cambiarEmergencia(context, v),
              child: const Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: 'Emergencia',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    TextSpan(
                      text:
                          ' — habilita el inicio dentro de las próximas 48h y '
                          'permite hasta 3 permisos/mes. El backend rechazará '
                          'el 4º.',
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        if (form.tipo == 'mantenimiento')
          _Bloque(
            campos: [
              texto(
                'wz-area-afectada',
                'Área afectada *',
                form.areaAfectada,
                (v) => form.areaAfectada = v,
                maxLength: 200,
              ),
            ],
            pie: [
              _Casilla(
                key: const Key('wz-requiere-ingreso'),
                valor: form.requiereIngresoALocal,
                onChanged: (v) {
                  form.requiereIngresoALocal = v;
                  onCambio();
                },
                child: const Text('Requiere ingreso al local'),
              ),
            ],
          ),
        if (form.tipo == 'remodelacion')
          _Bloque(
            campos: [
              CampoFecha(
                key: const Key('wz-fecha-inicio-estimada'),
                label: 'Fecha inicio estimada *',
                valorYmd: form.fechaInicioEstimada,
                onChanged: (v) {
                  form.fechaInicioEstimada = v;
                  onCambio();
                },
              ),
              texto(
                'wz-duracion-dias',
                'Duración (días) *',
                form.duracionDias,
                (v) => form.duracionDias = v,
                maxLength: 3,
                teclado: TextInputType.number,
                formato: [FilteringTextInputFormatter.digitsOnly],
              ),
              texto(
                'wz-empresa-constructora',
                'Empresa constructora *',
                form.empresaConstructora,
                (v) => form.empresaConstructora = v,
                maxLength: 160,
              ),
              texto(
                'wz-monto-presupuesto',
                'Monto presupuesto (USD) *',
                form.montoPresupuesto,
                (v) => form.montoPresupuesto = v,
                teclado: const TextInputType.numberWithOptions(decimal: true),
                formato: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
                ],
              ),
            ],
          ),
        _Bloque(
          campos: [
            texto(
              'asistentes-estimados',
              'Cantidad de Personal *',
              form.asistentesEstimados,
              (v) => form.asistentesEstimados = v,
              maxLength: 3,
              teclado: TextInputType.number,
              formato: [FilteringTextInputFormatter.digitsOnly],
            ),
          ],
          pie: [
            Text(
              form.tipo == 'evento'
                  ? 'Obligatorio (mínimo 1, máximo $maxPersonal). Si supera el '
                        'umbral configurado por la plaza, requerirá aprobación '
                        'especial.'
                  : 'Obligatorio (mínimo 1, máximo $maxPersonal). Completa '
                        'nombre y documento de cada persona.',
              style: TextStyle(fontSize: 12, color: c.text3),
            ),
            if (n == 0)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'Indicá al menos 1 persona de personal.',
                  style: TextStyle(fontSize: 12, color: aviso),
                ),
              )
            else ...[
              const SizedBox(height: 10),
              Text(
                'Información del personal ($n)',
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 8),
              for (var i = 0; i < n; i++)
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    border: Border.all(color: c.border),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: _Rejilla(
                    children: [
                      texto(
                        'asistente-$i-nombre',
                        'Nombre *',
                        form.asistente(i).nombre,
                        (v) => form.asistente(i).nombre = v,
                        maxLength: 120,
                        hint: 'Persona ${i + 1}',
                      ),
                      texto(
                        'asistente-$i-documento',
                        'Documento *',
                        form.asistente(i).documento,
                        (v) => form.asistente(i).documento = v,
                        maxLength: 20,
                        hint: 'DUI, NIT, pasaporte…',
                      ),
                    ],
                  ),
                ),
            ],
          ],
        ),
      ],
    );
  }
}

/// Bloque con borde (`.wz-extra` del web): título opcional, campos en
/// rejilla y un pie a todo el ancho.
class _Bloque extends StatelessWidget {
  const _Bloque({this.titulo, required this.campos, this.pie = const []});

  final String? titulo;
  final List<Widget> campos;
  final List<Widget> pie;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface2,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (titulo != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                titulo!,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          _Rejilla(children: campos),
          if (pie.isNotEmpty) ...[const SizedBox(height: 8), ...pie],
        ],
      ),
    );
  }
}

/// Campos en 2 columnas cuando hay espacio, 1 en teléfono.
class _Rejilla extends StatelessWidget {
  const _Rejilla({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final cols = c.maxWidth >= 520 ? 2 : 1;
        const gap = 12.0;
        final ancho = (c.maxWidth - gap * (cols - 1)) / cols;
        return Wrap(
          spacing: gap,
          runSpacing: 12,
          children: [
            for (final w in children) SizedBox(width: ancho, child: w),
          ],
        );
      },
    );
  }
}

/// Casilla de verificación con texto que se ajusta.
class _Casilla extends StatelessWidget {
  const _Casilla({
    super.key,
    required this.valor,
    required this.onChanged,
    required this.child,
  });

  final bool valor;
  final ValueChanged<bool> onChanged;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => onChanged(!valor),
      borderRadius: BorderRadius.circular(7),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(value: valor, onChanged: (v) => onChanged(v ?? false)),
            const SizedBox(width: 4),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 12),
                child: DefaultTextStyle.merge(
                  style: const TextStyle(fontSize: 13.5),
                  child: child,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
