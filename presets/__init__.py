"""
Sistema de estructuras predefinidas para Scout 3D.
Importa todos los presets disponibles para uso en main.py.
"""

from .mangrullo import construir_mangrullo
from .estrella import construir_estrella
from .torre_simple import construir_torre_simple

__all__ = [
    'construir_mangrullo',
    'construir_estrella',
    'construir_torre_simple',
    'PRESETS',
]

# Registro de todos los presets disponibles
PRESETS = {
    'mangrullo': {
        'nombre': 'Mangrullo (Estructura por defecto)',
        'descripcion': 'Torre con estructuras cuadradas conectadas por puente',
        'funcion': construir_mangrullo,
    },
    'estrella': {
        'nombre': 'Estrella Scout (Hexagrama)',
        'descripcion': 'Base elevada con trípodes y dos triángulos equiláteros superpuestos',
        'funcion': construir_estrella,
    },
    'torre_simple': {
        'nombre': 'Torre Simple',
        'descripcion': 'Torre de una sola columna cuadrada de 4 palos',
        'funcion': construir_torre_simple,
    },
}


def listar_presets():
    """Retorna lista formateada de todos los presets disponibles."""
    print("\n=== PRESETS DISPONIBLES ===")
    for clave, info in PRESETS.items():
        print(f"\n[{clave}] {info['nombre']}")
        print(f"    {info['descripcion']}")
    print("\n")
