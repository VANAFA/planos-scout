"""
Scout 3D - Sistema de Estructuras Predefinidas
Main: Selector de estructuras prehechas con visualización automática.

Uso:
    1. Cambia el valor de PRESET_SELECCIONADO a uno de los presets disponibles
    2. Ejecuta: python main.py
    3. Se construirá la estructura seleccionada automáticamente

Presets disponibles:
    - 'mangrullo': Torre con estructuras cuadradas conectadas por puente (DEFAULT)
    - 'estrella': Base elevada con trípodes y hexagrama
    - 'torre_simple': Torre simple de una columna cuadrada
"""

from presets import PRESETS, listar_presets
from engine import Engine3D

# ============ SELECTOR DE ESTRUCTURA ============
# Cambia este valor para seleccionar la estructura a construir
PRESET_SELECCIONADO = 'mangrullo'  # Opciones: 'mangrullo', 'estrella', 'torre_simple'
# ===============================================


def main():
    """
    Carga y visualiza la estructura seleccionada.
    """
    
    # Mostrar presets disponibles
    print("\n" + "="*60)
    print("SCOUT 3D - SISTEMA DE ESTRUCTURAS PREDEFINIDAS")
    print("="*60)
    listar_presets()
    
    # Validar selección
    if PRESET_SELECCIONADO not in PRESETS:
        print(f"❌ ERROR: Preset '{PRESET_SELECCIONADO}' no encontrado.")
        print(f"Presets disponibles: {', '.join(PRESETS.keys())}")
        return
    
    # Obtener información del preset
    info_preset = PRESETS[PRESET_SELECCIONADO]
    funcion_construccion = info_preset['funcion']
    
    print(f"\n✓ Preset seleccionado: [{PRESET_SELECCIONADO}]")
    print(f"  {info_preset['nombre']}")
    print(f"  {info_preset['descripcion']}")
    print("\nConstructing structure...\n")
    
    # Crear engine y construir la estructura
    engine = Engine3D()
    engine = funcion_construccion(engine)
    
    # Exportar datos
    print("\nExporting project data...")
    print(engine.generar_resumen_montaje_texto())
    
    engine.exportar_proyecto_json("proyecto_scout.json")
    engine.exportar_manual_pdf("manual_scout.pdf", titulo=f"Manual Scout - {info_preset['nombre']}")
    engine.exportar_gif_rotacion_horizontal(
        "rotacion_scout.gif",
        segundos=6,
        elevacion=20,
        mostrar_intersecciones=True,
    )
    
    # Visualizar
    print(f"\n✓ Visualization: {PRESET_SELECCIONADO}")
    engine.show(mostrar_intersecciones=True)


if __name__ == "__main__":
    main()
