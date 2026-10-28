/// Respuesta paginada del backend: `{ items, total, page, pageSize, totalPages }`.
class Paginado<T> {
  const Paginado({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
    required this.totalPages,
  });

  factory Paginado.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) item,
  ) {
    final lista = (json['items'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(item)
        .toList();
    final pageSize = (json['pageSize'] as num?)?.toInt() ?? lista.length;
    final total = (json['total'] as num?)?.toInt() ?? lista.length;
    return Paginado(
      items: lista,
      total: total,
      page: (json['page'] as num?)?.toInt() ?? 1,
      pageSize: pageSize,
      totalPages:
          (json['totalPages'] as num?)?.toInt() ??
          (pageSize == 0 ? 1 : (total / pageSize).ceil()),
    );
  }

  final List<T> items;
  final int total;
  final int page;
  final int pageSize;
  final int totalPages;
}
