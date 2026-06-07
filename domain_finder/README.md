# Domain Finder

Encuentra dominios .com próximos a vencer sin marca registrada.

## Uso rápido

```bash
cd domain_finder

# Flujo completo (intenta scraping → fallback CSV → marca → score → reporte)
python main.py

# Forzar lectura desde CSV local (dominios_input.csv)
python main.py --csv

# Saltar pasos individuales (útil para re-ejecutar parcialmente)
python main.py --skip-fetch          # usa dominios ya en DB
python main.py --skip-tm             # no verifica marcas
python main.py --skip-fetch --skip-tm  # solo recalcula scores y reporte
```

## Formato del CSV de entrada (`dominios_input.csv`)

```csv
dominio,fecha_expiracion
techgarden.com,2025-07-10
freshleafcare.com,2025-07-15
```

## Archivos generados

| Archivo | Descripción |
|---------|-------------|
| `dominios.db` | SQLite con todos los dominios analizados |
| `candidatos.csv` | Top 20 candidatos exportados |

## Scoring (0–10)

| Criterio | Puntos |
|----------|--------|
| Nombre genérico/descriptivo | +3 |
| No aparece en búsqueda (top 3) | +2 |
| Sin redes sociales activas | +2 |
| Más de 50 backlinks | +2 |
| Expira en < 15 días | +1 |

## Dependencias

Solo `requests` (stdlib para el resto): `pip install requests`
